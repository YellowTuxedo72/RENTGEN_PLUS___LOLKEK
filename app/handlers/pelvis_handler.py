
import os
import json
import cv2
import numpy as np
import torch
import math
from PIL import Image
import torchvision.transforms as T
from app.handlers.base import BaseHandler
from pathlib import Path

from app.models.pelvis.trains.train_A import Model as A_Model
from app.models.pelvis.trains.train_H import Model as H_Model
from app.models.pelvis.trains.train_OC import Model as OC_Model
from app.models.pelvis.trains.train_SH import Model as SH_Model


class PelvisHandler(BaseHandler):

    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.input_size = 768

        # =========================
        # МЕТКИ
        # =========================
        self.labels = {
            "A": ['R_A','L_A'],
            "H": ['R_H','L_H'],
            "OC": ['R_OC','L_OC'],
            "SH": [
                'R_SH_0','R_SH_1','R_SH_2','R_SH_3','R_SH_4',
                'L_SH_0','L_SH_1','L_SH_2','L_SH_3','L_SH_4'
            ]
        }

        # =========================
        # МОДЕЛИ
        # =========================
        self.models = {
            "A": A_Model(num_kp=2),
            "H": H_Model(num_kp=2),
            "OC": OC_Model(num_kp=2),
            "SH": SH_Model(num_kp=10),
        }

        BASE_DIR = Path(__file__).resolve().parent.parent
        WEIGHTS_DIR = BASE_DIR / "models" / "pelvis" / "weights"

        model_paths = {
            "A": WEIGHTS_DIR / "model_A.pth",
            "H": WEIGHTS_DIR / "model_H.pth",
            "OC": WEIGHTS_DIR / "model_OC.pth",
            "SH": WEIGHTS_DIR / "model_SH.pth",
        }

        for key in self.models:
            self.models[key].load_state_dict(
                torch.load(model_paths[key], map_location=self.device)
            )
            self.models[key].to(self.device)
            self.models[key].eval()

        self.transform = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=[0.5], std=[0.5])
        ])


    def handle(self, data):
        img = data["image"]
        img_name = data.get("image_name", "image")  # ожидаем, что передали имя файла
        base_name = os.path.splitext(os.path.basename(img_name))[0]

        if len(img.shape) == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        all_preds = {}
        for key in self.models:
            pts = self._predict_one(self.models[key], img, self.labels[key])
            all_preds[key] = pts

        analysis_result = self._analyze_pelvis(all_preds)

        os.makedirs("outputs", exist_ok=True)

        # JSON с точками
        json_path = f"outputs/{base_name}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(all_preds, f, indent=2, ensure_ascii=False)

        # Визуализация
        vis_path = f"outputs/{base_name}.jpg"
        self._visualize(img, all_preds, vis_path)

        # --- TXT файл с текстовой информацией ---
        txt_path = f"outputs/{base_name}.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            for text_info in analysis_result["result"]["texts"]:
                f.write(text_info["text"] + "\n")

        return {
            "status": "ok",
            "type": "analysis",
            "image_path": vis_path,
            "json_path": json_path,
            "txt_path": txt_path,
            "raw_points": all_preds,
            "analysis": analysis_result
        }

    def _predict_one(self, model, img, labels):
        orig_h, orig_w = img.shape[:2]

        img_resized = cv2.resize(img, (self.input_size, self.input_size))
        img_pil = Image.fromarray(img_resized)

        img_tensor = self.transform(img_pil).unsqueeze(0).to(self.device)

        with torch.no_grad():
            pred_hm = model(img_tensor).cpu().numpy()[0]

        pts = self._heatmaps_to_points(pred_hm, (orig_w, orig_h))
        return dict(zip(labels, pts))

    def _heatmaps_to_points(self, hms, orig_size):
        K, H, W = hms.shape
        orig_w, orig_h = orig_size
        points = []

        for k in range(K):
            hm = hms[k]
            y, x = np.unravel_index(np.argmax(hm), hm.shape)

            if 1 < x < W-2 and 1 < y < H-2:
                dx = hm[y, x+1] - hm[y, x-1]
                dy = hm[y+1, x] - hm[y-1, x]
                x += np.sign(dx) * 0.25
                y += np.sign(dy) * 0.25

            x = x * (orig_w / W)
            y = y * (orig_h / H)

            points.append((float(x), float(y)))

        return points

    def _analyze_pelvis(self, data):
        result = {
            "points": [],
            "lines": [],
            "angles": [],
            "texts": []
        }

        for group in data:
            for key, val in data[group].items():
                result["points"].append({
                    "id": key,
                    "x": val[0],
                    "y": val[1],
                    "name": key
                })


        if "A" in data and "H" in data:
            L_A = data["A"]["L_A"]
            R_A = data["A"]["R_A"]
            R_H = data["H"]["R_H"]
            L_H = data["H"]["L_H"]

            angle_R = self._angle_between_lines(L_A, R_A, R_H, R_A)
            angle_L = 180 - self._angle_between_lines(L_A, R_A, L_H, L_A)

            result["angles"].append({
                "id": "acetabular_R",
                "value": angle_R
            })

            result["angles"].append({
                "id": "acetabular_L",
                "value": angle_L
            })

            # диагноз
            def check(a):
                return "Дисплазия" if a > 33 else "Норма"

            result["texts"].append({
                "text": f"Правый угол: {angle_R:.2f}° — {check(angle_R)}"
            })

            result["texts"].append({
                "text": f"Левый угол: {angle_L:.2f}° — {check(angle_L)}"
            })

        if "SH" in data:
            def shenton(prefix):
                pts = [data["SH"][f"{prefix}_{i}"] for i in range(5)]
                return self._angle_at_vertex(pts[1], pts[2], pts[3])

            sh_R = shenton("R_SH")
            sh_L = shenton("L_SH")

            result["texts"].append({
                "text": f"Шентон справа: {sh_R:.2f}°"
            })

            result["texts"].append({
                "text": f"Шентон слева: {sh_L:.2f}°"
            })

        if "OC" in data:
            R = data["OC"].get("R_OC")
            L = data["OC"].get("L_OC")

            has_R = bool(R and R != [0,0])
            has_L = bool(L and L != [0,0])

            if has_R and has_L:
                txt = "Оба ядра присутствуют"
            elif has_R:
                txt = "Только правое ядро"
            elif has_L:
                txt = "Только левое ядро"
            else:
                txt = "Ядра отсутствуют"

            result["texts"].append({"text": txt})

        return {
            "status": "ok",
            "result": result
        }


    def _angle_between_lines(self, p1, p2, p3, p4):
        v1 = (p2[0] - p1[0], p2[1] - p1[1])
        v2 = (p4[0] - p3[0], p4[1] - p3[1])

        dot = v1[0]*v2[0] + v1[1]*v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

        cos_angle = max(min(dot / (mag1 * mag2), 1.0), -1.0)
        return math.degrees(math.acos(cos_angle))

    def _angle_at_vertex(self, p1, p2, p3):
        v1 = (p1[0]-p2[0], p1[1]-p2[1])
        v2 = (p3[0]-p2[0], p3[1]-p2[1])

        dot = v1[0]*v2[0] + v1[1]*v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)

        if mag1 == 0 or mag2 == 0:
            return 0.0

        cos_angle = max(min(dot/(mag1*mag2), 1), -1)
        return math.degrees(math.acos(cos_angle))


    def _visualize(self, img, all_preds, save_path):
        img_color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        colors = {
            "A": (0, 0, 255),
            "H": (0, 255, 0),
            "OC": (255, 255, 0),
            "SH": (255, 0, 0)
        }

        for model_name, pts_dict in all_preds.items():
            color = colors.get(model_name, (255, 255, 255))

            for label, (x, y) in pts_dict.items():
                x, y = int(x), int(y)

                cv2.circle(img_color, (x, y), 5, color, -1)
                cv2.putText(img_color, label, (x+5, y-5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        cv2.imwrite(save_path, img_color)