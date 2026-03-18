# keypoint_train_fixed.py

import os
import json
import glob
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T
import torchvision.models as models
from tqdm import tqdm

# ================== CONFIG ==================
CONFIG = {
    "images_dir": "data/images",
    "json_dir": "data/jsons",
    "labels": ['R_OC', 'L_OC'],

    "input_size": 768,   # одно число!
    "sigma": 2,

    "batch_size": 6,
    "epochs": 80,
    "lr": 5e-5,

    "num_workers": 4
}
# ===========================================


# ------------ Utils ------------
def load_labelme_json(json_path):
    j = json.load(open(json_path,'r', encoding='utf-8'))
    shapes = j.get('shapes', [])
    pts = {}
    for s in shapes:
        if s.get('shape_type') == 'point':
            pts[s['label']] = tuple(s['points'][0])
    return pts


def gaussian_2d(shape, sigma=2):
    m, n = [(ss - 1.) / 2. for ss in shape]
    y, x = np.ogrid[-m:m+1,-n:n+1]
    return np.exp(-(x*x + y*y) / (2*sigma*sigma))


def draw_gaussian(hm, center, sigma):
    tmp = int(3 * sigma)
    x, y = int(center[0]), int(center[1])
    h, w = hm.shape

    ul = [x - tmp, y - tmp]
    br = [x + tmp, y + tmp]

    if ul[0] >= w or ul[1] >= h or br[0] < 0 or br[1] < 0:
        return hm

    size = 2*tmp + 1
    g = gaussian_2d((size, size), sigma)

    g_x = max(0, -ul[0]), min(br[0], w-1) - ul[0] + 1
    g_y = max(0, -ul[1]), min(br[1], h-1) - ul[1] + 1

    img_x = max(0, ul[0]), min(br[0], w-1) + 1
    img_y = max(0, ul[1]), min(br[1], h-1) + 1

    hm[img_y[0]:img_y[1], img_x[0]:img_x[1]] = np.maximum(
        hm[img_y[0]:img_y[1], img_x[0]:img_x[1]],
        g[g_y[0]:g_y[1], g_x[0]:g_x[1]]
    )
    return hm


# ------------ Dataset ------------
class KeypointDataset(Dataset):
    def __init__(self, cfg):
        self.cfg = cfg
        self.images = sorted(glob.glob(os.path.join(cfg["images_dir"], '*')))
        self.jsons = sorted(glob.glob(os.path.join(cfg["json_dir"], '*.json')))

        json_map = {Path(j).stem: j for j in self.jsons}

        self.data = []
        for img in self.images:
            base = Path(img).stem
            if base in json_map:
                self.data.append((img, json_map[base]))

        self.labels = cfg["labels"]
        self.size = cfg["input_size"]
        self.out_size = self.size // 4
        self.sigma = cfg["sigma"]

        self.to_tensor = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=[0.5], std=[0.5])
        ])

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        img_path, json_path = self.data[idx]

        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        h0, w0 = img.shape

        img = cv2.resize(img, (self.size, self.size))
        img_t = self.to_tensor(Image.fromarray(img))

        pts = load_labelme_json(json_path)
        
        heatmaps = np.zeros((len(self.labels), self.out_size, self.out_size), dtype=np.float32)
        vis = np.zeros(len(self.labels), dtype=np.float32)

        for i, lab in enumerate(self.labels):
            if lab in pts:
                x, y = pts[lab]

                x = x * (self.out_size / w0)
                y = y * (self.out_size / h0)

                heatmaps[i] = draw_gaussian(heatmaps[i], (x, y), self.sigma)
                vis[i] = 1

        return {
            "image": img_t,
            "heatmaps": torch.tensor(heatmaps),
            "vis": torch.tensor(vis),
            "orig_size": (w0, h0)
        }


# ------------ Model ------------
class Model(nn.Module):
    def __init__(self, num_kp):
        super().__init__()

        res = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

        w = res.conv1.weight.data
        res.conv1 = nn.Conv2d(1, 64, 7, 2, 3, bias=False)
        res.conv1.weight.data = w.mean(1, keepdim=True)

        self.backbone = nn.Sequential(*list(res.children())[:-2])

        self.head = nn.Sequential(
            nn.Conv2d(512, 256, 3, padding=1),
            nn.ReLU(),
            nn.ConvTranspose2d(256, 128, 4, 2, 1),
            nn.ReLU(),
            nn.ConvTranspose2d(128, 64, 4, 2, 1),
            nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 4, 2, 1),
            nn.ReLU(),
            nn.Conv2d(32, num_kp, 1)
        )

    def forward(self, x):
        return self.head(self.backbone(x))


# ------------ Train ------------
def train(model, loader, cfg, device):
    opt = torch.optim.Adam(model.parameters(), lr=cfg["lr"])
    loss_fn = nn.MSELoss()

    for epoch in range(cfg["epochs"]):
        model.train()
        total = 0

        for b in tqdm(loader):
            x = b["image"].to(device)
            y = b["heatmaps"].to(device)
            vis = b["vis"].to(device)[:, :, None, None]

            pred = model(x)

            loss = loss_fn(pred * vis, y * vis)

            opt.zero_grad()
            loss.backward()
            opt.step()

            total += loss.item()

        print(f"Epoch {epoch} loss {total / len(loader)}")


# ------------ Inference ------------
def predict(model, sample, cfg, device):
    model.eval()

    x = sample["image"].unsqueeze(0).to(device)

    with torch.no_grad():
        hm = model(x)[0].cpu().numpy()

    H, W = hm.shape[1:]

    pts = []
    for k in range(len(cfg["labels"])):
        y, x = np.unravel_index(np.argmax(hm[k]), hm[k].shape)

        x = x * (sample["orig_size"][0] / W)
        y = y * (sample["orig_size"][1] / H)

        pts.append((x, y))

    return pts


# ------------ MAIN ------------
if __name__ == "__main__":
    cfg = CONFIG

    device = "cuda" if torch.cuda.is_available() else "cpu"

    ds = KeypointDataset(cfg)
    dl = DataLoader(ds,
                    batch_size=cfg["batch_size"],
                    shuffle=True,
                    num_workers=cfg["num_workers"],
                    pin_memory=True)

    model = Model(len(cfg["labels"])).to(device)

    train(model, dl, cfg, device)

    torch.save(model.state_dict(), "model.pth")

    sample = ds[0]
    pts = predict(model, sample, cfg, device)

    print("PRED:", pts)