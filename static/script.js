window.images = {};
const images = window.images;

let currentTool = "linestrip";

let currentMousePos = null;

let selectedPoint = null; 
let selectedDrawing = null;
let isDraggingPoint = false;
let activeCanvas = null;

document.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && selectedDrawing) {
    drawState.drawings = drawState.drawings.filter(d => d !== selectedDrawing);
    selectedDrawing = null;
    redraw(window.activeImage?.nextSibling);
  }
});

function findPointAt(canvas, x, y) {
  const radius = 8;

  for (let d of drawState.drawings) {
    for (let p of d.points) {
      const px = p.x * canvas.width;
      const py = p.y * canvas.height;

      const dist = Math.hypot(px - x, py - y);
      if (dist < radius) {
        return { point: p, drawing: d };
      }
    }
  }

  return null;
}


let drawState = {
  points: [],   
  drawings: []    
};

document.querySelectorAll(".tool").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tool = btn.dataset.tool.toLowerCase();

    if (tool === "linestrip") currentTool = "linestrip";
    if (tool === "angel") currentTool = "angle";

    drawState.points = [];
  });
});

function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function setupDrawingSimple(canvas) {
canvas.addEventListener("click", (e) => {
  if (!currentTool) return; 

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    drawState.points.push({ x, y });

    if (currentTool === "angle" && drawState.points.length === 3) {
      drawState.drawings.push({
        type: "angle",
        points: [...drawState.points]
      });
      drawState.points = [];
    }

    redraw(canvas);
  });

  canvas.addEventListener("dblclick", () => {
    if (currentTool === "linestrip" && drawState.points.length > 1) {
      drawState.drawings.push({
        type: "line",
        points: [...drawState.points]
      });

      drawState.points = [];
      redraw(canvas);
    }
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    if (currentTool === "linestrip" && drawState.points.length > 1) {
      drawState.drawings.push({
        type: "line",
        points: [...drawState.points]
      });
    }

    drawState.points = [];
    currentTool = null;
    selectedDrawing = null;

    document.querySelectorAll(".tool").forEach(b => b.classList.remove("active"));

    redraw(canvas);
  });
canvas.oncontextmenu = () => false;
canvas.addEventListener("mousedown", (e) => {
  const pos = getMousePos(canvas, e);

  const hit = findPointAt(canvas, pos.x, pos.y);

    if (hit) {
    selectedPoint = hit.point;
    selectedDrawing = hit.drawing;
    isDraggingPoint = true;
  } else {
    selectedDrawing = null;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDraggingPoint || !selectedPoint) return;

  const pos = getMousePos(canvas, e);
  selectedPoint.x = pos.x / canvas.width;
  selectedPoint.y = pos.y / canvas.height;

  redraw(canvas);
});

canvas.addEventListener("mouseup", () => {
  isDraggingPoint = false;
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(canvas, e);
    currentMousePos = { x: pos.x / canvas.width, y: pos.y / canvas.height };

    if (isDraggingPoint && selectedPoint) {
        selectedPoint.x = currentMousePos.x;
        selectedPoint.y = currentMousePos.y;
    }

    redraw(canvas);
});

canvas.addEventListener("mouseleave", () => {
    currentMousePos = null;
    redraw(canvas);
});
}

function redraw(canvas) {
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentTool === "linestrip" && drawState.points.length > 1) {
    ctx.beginPath();

    const first = drawState.points[0];
    ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

    for (let i = 1; i < drawState.points.length; i++) {
      const p = drawState.points[i];
      ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    }

    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawState.points.forEach(p => {
    ctx.beginPath();
    const px = p.x * canvas.width;
    const py = p.y * canvas.height;
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
  });

  drawState.drawings.forEach(d => {
  if (d.type === "angle") {
    drawAngle(ctx, d.points, canvas);
  }

  if (d.type === "line") {
    ctx.beginPath();

    const first = d.points[0];
    ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

    for (let i = 1; i < d.points.length; i++) {
      const p = d.points[i];
      ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    }

    ctx.strokeStyle = (d === selectedDrawing) ? "orange" : "cyan";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
);
drawState.drawings.forEach(d => {
  d.points.forEach(p => {
    ctx.beginPath();

    const px = p.x * canvas.width;
    const py = p.y * canvas.height;

    ctx.arc(px, py, 5, 0, Math.PI * 2);

    ctx.fillStyle = (d === selectedDrawing) ? "orange" : "red";
    ctx.fill();
  });
if (d.type === 'text') {
  const p = d.points[0];
  const px = p.x * canvas.width;
  const py = p.y * canvas.height;

  ctx.fillStyle = 'yellow';
  ctx.font = '16px Arial';
  ctx.fillText(d.text, px + 5, py - 5);
}});

if (currentTool === "linestrip" && drawState.points.length > 0 && currentMousePos) {
    ctx.beginPath();
    const last = drawState.points[drawState.points.length - 1];
    ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
    ctx.lineTo(currentMousePos.x * canvas.width, currentMousePos.y * canvas.height);
    ctx.strokeStyle = "lime"; 
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]); 
}
}

function drawAngle(ctx, pts, canvas) {
  const [A, B, C] = pts;

  const Ax = A.x * canvas.width;
  const Ay = A.y * canvas.height;

  const Bx = B.x * canvas.width;
  const By = B.y * canvas.height;

  const Cx = C.x * canvas.width;
  const Cy = C.y * canvas.height;
  const angle = calculateAngle(A, B, C);

  // линии
  ctx.beginPath();
  ctx.moveTo(Bx, By);
  ctx.lineTo(Ax, Ay);
  ctx.moveTo(Bx, By);
  ctx.lineTo(Cx, Cy);
  ctx.strokeStyle = (pts === selectedDrawing?.points) ? "orange" : "yellow";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "yellow";
  ctx.font = "16px Arial";
  ctx.fillText(angle.toFixed(1) + "°", Bx + 10, By - 10);
}

function calculateAngle(A, B, C) {
  const BA = [A.x - B.x, A.y - B.y];
  const BC = [C.x - B.x, C.y - B.y];

  const dot = BA[0]*BC[0] + BA[1]*BC[1];
  const mag1 = Math.hypot(BA[0], BA[1]);
  const mag2 = Math.hypot(BC[0], BC[1]);

  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * 180 / Math.PI;
}

(function() {
document.addEventListener('DOMContentLoaded', function() {
  const setupCustomSelect = (triggerId, optionsId, selectedId, callback) => {
    const trigger = document.getElementById(triggerId);
    const options = document.getElementById(optionsId);
    const selectedSpan = document.getElementById(selectedId);
    const customSelect = trigger.closest('.custom-select');
    
    if (!trigger || !options || !selectedSpan) return;
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      customSelect.classList.toggle('open');
    });
    
    options.querySelectorAll('.select-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.textContent;
        selectedSpan.textContent = value;
        
        options.querySelectorAll('.select-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        option.classList.add('selected');
        
        customSelect.classList.remove('open');

        if (callback) callback(option.dataset.value, value);
        
        checkFormCompletion();
      });
    });
  };
  
  setupCustomSelect('shotTypeTrigger', 'shotTypeOptions', 'selectedShotType', (value, text) => {
    console.log('Выбран тип снимка:', value);
  });
  
  setupCustomSelect('diagnosisTrigger', 'diagnosisOptions', 'selectedDiagnosis', (value, text) => {
    console.log('Выбран диагноз:', value);
  });
  
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(select => {
      select.classList.remove('open');
    });
  });
  
  let rotation = 0;
  let flipped = false;
  
  document.getElementById('rotateBtn').addEventListener('click', () => {
    const img = document.getElementById('analysisImage');
    rotation = (rotation + 90) % 360;
    updateImageTransform(img);
  });
  
  document.getElementById('flipBtn').addEventListener('click', () => {
    const img = document.getElementById('analysisImage');
    flipped = !flipped;
    updateImageTransform(img);
  });
  
  function updateImageTransform(img) {
    let transform = '';
    if (rotation) transform += `rotate(${rotation}deg) `;
    if (flipped) transform += `scaleX(-1)`;
    img.style.transform = transform.trim();

    const container = document.getElementById('imagePreviewContainer');
    if (container) {
      container.style.overflow = 'hidden';
    }
  }
  
  function checkFormCompletion() {
    const shotType = document.getElementById('selectedShotType').textContent;
    const diagnosis = document.getElementById('selectedDiagnosis').textContent;
    const age = document.getElementById('patientAge').value;
    const sendBtn = document.getElementById('sendAnalysis');
    
    if (shotType !== 'Выберите тип' && 
        diagnosis !== 'Выберите диагноз' && 
        age && age > 0) {
      sendBtn.classList.remove('disabled');
    } else {
      sendBtn.classList.add('disabled');
    }
  }
  
  document.getElementById('patientAge').addEventListener('input', checkFormCompletion);
  
  document.getElementById('cancelAnalysis').addEventListener('click', () => {
    document.getElementById('analysisOverlay').classList.remove('show');
  });
  
  window.openAnalysisModal = function(imageSrc, imageName) {
    const overlay = document.getElementById('analysisOverlay');
    const analysisImg = document.getElementById('analysisImage');
    const selectedName = document.getElementById('selectedImageName');
    
    if (imageSrc) {
      analysisImg.src = imageSrc;
    }
    
    if (imageName) {
      selectedName.textContent = imageName;
    }
    
    rotation = 0;
    flipped = false;
    analysisImg.style.transform = '';
    
    overlay.classList.add('show');
  };
});
  window.activeImage = null;
  
  const app = document.getElementById('app');
  if (window.analysisModalInitialized) return;
  window.analysisModalInitialized = true;
  const analysisOverlay = document.getElementById('analysisOverlay');
  const closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
  const cancelAnalysis = document.getElementById('cancelAnalysis');
  const doAnalysisBtn = document.getElementById('doAnalysis');
  const analysisImage = document.getElementById('analysisImage');
  const flipBtn = document.getElementById('flipBtn');
  const rotateBtn = document.getElementById('rotateBtn');
  const sendBtn = document.getElementById('sendAnalysis');
  const ageInput = document.getElementById('patientAge');
  const selectedImageName = document.getElementById('selectedImageName');
  const shotType = document.getElementById('shotType');
  const diagnosis = document.getElementById('diagnosis');


  let flipped = false;
  let rotation = 0;
  let currentAnalysisImage = null;

  function getActiveImage() {
    if (typeof activeImage !== 'undefined') {
      return activeImage;
    }
    
    if (window.activeImage) {
      return window.activeImage;
    }
    
    console.warn('activeImage not found in global scope');
    return null;
  }

  function getImages() {
    if (typeof images !== 'undefined') {
      return images;
    }
    if (window.images) {
      return window.images;
    }
    console.warn('images not found in global scope');
    return {};
  }

  function openAnalysisModal() {
    console.log('openAnalysisModal called');
    
    const activeImg = getActiveImage();
    const imagesMap = getImages();
    
    if (!activeImg) {
      alert('Сначала выберите изображение для анализа');
      return;
    }

    const record = imagesMap[activeImg.dataset.id];
    if (!record) {
      console.error('Record not found for id:', activeImg.dataset.id);
      alert('Изображение не найдено');
      return;
    }

    currentAnalysisImage = activeImg;
    analysisImage.src = record.imgElement.src;
    selectedImageName.textContent = record.name;

    flipped = false;
    rotation = 0;
    analysisImage.style.transform = 'none';

    if (shotType) {
      const span = shotType.querySelector('span');
      if (span) span.textContent = 'Выберите тип';
    }
    
    if (diagnosis) {
      const span = diagnosis.querySelector('span');
      if (span) span.textContent = 'Выберите диагноз';
    }
    
    if (ageInput) ageInput.value = '';
    
    if (sendBtn) sendBtn.classList.add('disabled');

    analysisOverlay.classList.add('show');
    analysisOverlay.setAttribute('aria-hidden', 'false');
    
    document.body.classList.add('main-content-disabled');
    document.body.style.overflow = 'hidden';
  }

  function closeAnalysisModal() {
    analysisOverlay.classList.remove('show');
    analysisOverlay.setAttribute('aria-hidden', 'true');
    
  
    document.body.classList.remove('main-content-disabled');
    document.body.style.overflow = '';
  }

  function updateTransform() {
    let transform = '';
    if (flipped) transform += 'scaleX(-1) ';
    if (rotation) transform += `rotate(${rotation}deg)`;
    analysisImage.style.transform = transform || 'none';
  }

  function updateSendButtonState() {
    if (sendBtn && ageInput) {
      if (ageInput.value && ageInput.value.trim() !== '') {
        sendBtn.classList.remove('disabled');
      } else {
        sendBtn.classList.add('disabled');
      }
    }
  }

  console.log('Setting up analysis modal handlers');

  if (doAnalysisBtn) {
    doAnalysisBtn.removeEventListener('click', openAnalysisModal);
    doAnalysisBtn.addEventListener('click', openAnalysisModal);
    console.log('Handler added to doAnalysisBtn');
  } else {
    console.error('doAnalysisBtn not found!');
  }

  if (closeAnalysisBtn) {
    closeAnalysisBtn.addEventListener('click', closeAnalysisModal);
  }

  if (cancelAnalysis) {
    cancelAnalysis.addEventListener('click', closeAnalysisModal);
  }

  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      flipped = !flipped;
      updateTransform();
    });
  }

  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      updateTransform();
    });
  }

  if (ageInput) {
    ageInput.addEventListener('input', updateSendButtonState);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('disabled')) return;
      
      const shotTypeSpan = shotType ? shotType.querySelector('span') : null;
      const diagnosisSpan = diagnosis ? diagnosis.querySelector('span') : null;
      
      const shotTypeValue = shotTypeSpan ? shotTypeSpan.textContent : 'не выбран';
      const diagnosisValue = diagnosisSpan ? diagnosisSpan.textContent : 'не выбран';
      const age = ageInput ? ageInput.value : '';
      const ageUnit = document.getElementById('ageUnit') ? document.getElementById('ageUnit').value : 'лет';
      
      alert(`Анализ отправлен!\n\nТип снимка: ${shotTypeValue}\nДиагноз: ${diagnosisValue}\nВозраст: ${age} ${ageUnit}`);
      closeAnalysisModal();
    });
  }

  if (analysisOverlay) {
    analysisOverlay.addEventListener('click', (e) => {
      if (e.target === analysisOverlay) {
        closeAnalysisModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && analysisOverlay && analysisOverlay.classList.contains('show')) {
      closeAnalysisModal();
    }
  });

  if (shotType) {
    const shotTypeMenu = document.getElementById('shotTypeMenu');
    if (shotTypeMenu) {
      shotType.addEventListener('click', () => {
        shotTypeMenu.style.display = shotTypeMenu.style.display === 'none' ? 'block' : 'none';
      });

      shotTypeMenu.querySelectorAll('.form-select').forEach(item => {
        item.addEventListener('click', () => {
          const span = shotType.querySelector('span');
          if (span) span.textContent = item.textContent;
          shotTypeMenu.style.display = 'none';
        });
      });
    }
  }

  // Выпадающий список для диагноза
  if (diagnosis) {
    const diagnosisOptions = ['Норма', 'Пневмония', 'Туберкулез', 'Перелом', 'Опухоль', 'Другое'];
    
    diagnosis.addEventListener('click', () => {
      // Удаляем предыдущее меню если было
      const oldMenu = document.getElementById('diagnosisMenu');
      if (oldMenu) oldMenu.remove();

      const menu = document.createElement('div');
      menu.id = 'diagnosisMenu';
      menu.style.position = 'fixed';
      menu.style.background = 'var(--panel-dark)';
      menu.style.border = '1px solid var(--border)';
      menu.style.borderRadius = '4px';
      menu.style.zIndex = '2000';
      menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      
      diagnosisOptions.forEach(opt => {
        const item = document.createElement('div');
        item.style.padding = '10px 12px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '13px';
        item.style.borderBottom = '1px solid var(--border)';
        item.textContent = opt;
        
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--panel)';
        });
        
        item.addEventListener('mouseleave', () => {
          item.style.background = '';
        });
        
        item.addEventListener('click', () => {
          const span = diagnosis.querySelector('span');
          if (span) span.textContent = opt;
          menu.remove();
        });
        
        menu.appendChild(item);
      });
      
      // Позиционируем меню
      const rect = diagnosis.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom) + 'px';
      menu.style.width = rect.width + 'px';
      
      document.body.appendChild(menu);
      
      // Закрытие по клику вне меню
      setTimeout(() => {
        function closeMenu(e) {
          if (!menu.contains(e.target) && e.target !== diagnosis) {
            if (menu.parentNode) menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        }
        document.addEventListener('click', closeMenu);
      }, 0);
    });
  }
})();
    (function() {
  const app = document.getElementById('app');
  const fileInput = document.getElementById('fileInput');
    const fileInput2 = document.getElementById('fileInput2');
  const imageLayer = document.getElementById('imageLayer');
  const shotList = document.getElementById('shotList');
  const toggleGraph = document.getElementById('toggleGraph');
  const canvasArea = document.getElementById('canvasArea');
  const canvasInner = document.getElementById('canvasInner');
  const addLabel = document.getElementById('addLabel');
  const addLabel2 = document.getElementById('addLabel2');
  let idCounter = 0;
  let topZ = 10;

const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
  saveBtn.addEventListener('click', saveActiveImageWithDialog);
}

async function saveActiveImageWithDialog() {
  if (!window.activeImage) {
    alert('Сначала выберите изображение');
    return;
  }
  
  const record = images[window.activeImage.dataset.id];
  if (!record) return;
  
  const img = record.imgElement;
  
  const patientNameInput = document.getElementById('patientName');
  let patientName = patientNameInput.value.trim();
  
  if (!patientName) {
    patientName = 'Patient';
  }
  

  const originalFileName = record.name;
  const fileExtension = originalFileName.includes('.') 
    ? originalFileName.substring(originalFileName.lastIndexOf('.'))
    : '.jpg';
  
 
  const safePatientName = patientName
    .replace(/[^a-zа-яё0-9\s]/gi, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100); 
  
  const newFileName = `${safePatientName}${fileExtension}`;

  
  try {

    const response = await fetch(img.src);
    const blob = await response.blob();
    
    // Создаем объект File
    const file = new File([blob], newFileName, { type: blob.type });
    
    // Используем современный API показа диалога сохранения
    if ('showSaveFilePicker' in window) {
      // Для современных браузеров (Chrome, Edge)
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: newFileName,
        types: [{
          description: 'Images',
          accept: {
            'image/*': ['.jpg', '.jpeg', '.png', '.gif']
          }
        }]
      });
      
      // Создаем поток для записи
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      showSaveFeedback('✓ Сохранено');
    } else {
      // Fallback для браузеров без поддержки showSaveFilePicker
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = newFileName; // Используем новое имя
      link.click();
      URL.revokeObjectURL(link.href);
      
      showSaveFeedback('✓ Сохранено (в папку Загрузки)');
    }
  } catch (err) {
    // Пользователь отменил сохранение или произошла ошибка
    if (err.name !== 'AbortError') {
      console.error('Ошибка при сохранении:', err);
      alert('Не удалось сохранить файл');
    }
  }
}
function showSaveFeedback(message) {
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn) return;
  
  const originalText = saveBtn.textContent;
  saveBtn.textContent = message;
  saveBtn.style.background = 'rgba(67, 243, 196, 0.2)';
  saveBtn.style.color = '#43f3c4';
  saveBtn.style.borderColor = '#43f3c4';
  
  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = '';
    saveBtn.style.color = '';
    saveBtn.style.borderColor = '';
  }, 2000);
}
  // Toggle graph visibility
  toggleGraph.addEventListener('click', () => {
    app.classList.toggle('canvas-collapsed');
    toggleGraph.textContent = app.classList.contains('canvas-collapsed') ? 'Показать графику' : 'Скрыть графику';
  });

  // Drag & drop загрузка файлов
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    canvasArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    canvasArea.addEventListener(eventName, () => {
      canvasInner.style.border = '2px dashed #43f3c4';
      canvasInner.style.backgroundColor = 'rgba(67, 243, 196, 0.05)';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    canvasArea.addEventListener(eventName, () => {
      canvasInner.style.border = '1px solid rgba(0,0,0,0.12)';
      canvasInner.style.backgroundColor = 'transparent';
    });
  });

  canvasArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files || []);
    if (files.length) {
      files.forEach(file => handleFile(file));
    }
  });

  // Загрузка через кнопку
  fileInput.addEventListener('change', (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    files.forEach(f => handleFile(f));
    fileInput.value = '';
  });
  fileInput2.addEventListener('change', (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    files.forEach(f => handleFile(f));
    fileInput2.value = '';
  });
  function handleFile(file) {
    const lower = (file.name || '').toLowerCase();
    const newId = 'img_' + (++idCounter);
    
    if (lower.endsWith('.dcm')) {
      // DICOM parsing
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const arrayBuffer = e.target.result;
          const byteArray = new Uint8Array(arrayBuffer);
          const dataSet = dicomParser.parseDicom(byteArray);
          const rows = dataSet.uint16('x00280010');
          const cols = dataSet.uint16('x00280011');
          const bitsAllocated = dataSet.uint16('x00280100') || 8;
          const photometric = (dataSet.string('x00280004') || 'MONOCHROME2').toUpperCase();
          const pixelElement = dataSet.elements.x7fe00010;
          
          if (!pixelElement) throw new Error('Нет PixelData в DICOM-файле');

          let canvas = document.createElement('canvas');
          canvas.width = cols;
          canvas.height = rows;
          let ctx = canvas.getContext('2d');
          let imageData = ctx.createImageData(cols, rows);
          const nPixels = cols * rows;

          if (bitsAllocated === 8) {
            const pixels = new Uint8Array(dataSet.byteArray.buffer, pixelElement.dataOffset, pixelElement.length);
            for (let i = 0; i < nPixels; i++) {
              let v = pixels[i];
              if (photometric === 'MONOCHROME1') v = 255 - v;
              const idx = i * 4;
              imageData.data[idx] = v;
              imageData.data[idx+1] = v;
              imageData.data[idx+2] = v;
              imageData.data[idx+3] = 255;
            }
          } else if (bitsAllocated === 16) {
            const byteOffset = pixelElement.dataOffset;
            const length = pixelElement.length;
            const uint16Count = length / 2;
            const ta = new Uint16Array(dataSet.byteArray.buffer, byteOffset, uint16Count);

            let min = Number.POSITIVE_INFINITY, max = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < uint16Count; i++) { 
              let v = ta[i]; 
              if (v < min) min = v; 
              if (v > max) max = v; 
            }
            if (min === max) { min = 0; max = 65535; }
            
            for (let i = 0; i < nPixels; i++) {
              let raw = ta[i];
              let v = Math.round((raw - min) / (max - min) * 255);
              if (v < 0) v = 0; 
              if (v > 255) v = 255;
              if (photometric === 'MONOCHROME1') v = 255 - v;
              const idx = i * 4;
              imageData.data[idx] = v;
              imageData.data[idx+1] = v;
              imageData.data[idx+2] = v;
              imageData.data[idx+3] = 255;
            }
          } else {
            throw new Error('Unsupported Bits Allocated: ' + bitsAllocated);
          }

          ctx.putImageData(imageData, 0, 0);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          addImageToLayer(newId, file.name, jpegDataUrl, false, file);
        } catch (err) {
          console.error(err);
          alert('Ошибка чтения DICOM: ' + (err && err.message ? err.message : err));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const url = URL.createObjectURL(file);
      addImageToLayer(newId, file.name, url, true, file);
    }
  }

  function addImageToLayer(id, name, src, isObjectUrl = false, file = null) {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';

      const img = document.createElement('img');
      img.src = src;
      img.style.display = 'block';
      img.style.userSelect = 'none';
      img.style.pointerEvents = 'none'; // клики идут в canvas
      img.dataset.id = id;

      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.zIndex = '10';

      wrapper.appendChild(img);
      wrapper.appendChild(canvas);

      const imageLayer = document.getElementById('imageLayer');
      imageLayer.innerHTML = ""; // показываем только одно изображение
      imageLayer.appendChild(wrapper);

      // Сохраняем в глобальный объект
      images[id] = {
          id,
          name,
          file,
          src,
          overlay: canvas,
          imgElement: img,
          wrapper: wrapper,
          isObjectUrl
      };

      // делаем активным
      window.activeImage = img;

      img.onload = () => {
          // Канвас внутренне совпадает с пикселями изображения
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          // CSS размеры канваса совпадают с размерами на странице
          canvas.style.width = img.clientWidth + "px";
          canvas.style.height = img.clientHeight + "px";

          // Настраиваем рисование
          setupDrawingSimple(canvas);

          // Первичная прорисовка
          redraw(canvas);
      };

      // Если окно ресайзится, масштабируем CSS канвас, чтобы линии оставались на месте
      window.addEventListener('resize', () => {
          canvas.style.width = img.clientWidth + "px";
          canvas.style.height = img.clientHeight + "px";
          redraw(canvas);
      });
  }

  function deleteImage(id) {
    const record = images[id];
    if (!record) return;
    
    if (record.isObjectUrl) {
      URL.revokeObjectURL(record.imgElement.src);
    }
    
    record.imgElement.remove();
    record.listElement.remove();
    
    if (window.activeImage === record.imgElement) {
      window.activeImage = null;
    }
    
    delete images[id];
  }

  // Удаление по клавише Delete
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && window.activeImage) {
      e.preventDefault();
      const id = window.activeImage.getAttribute('data-id');
      if (id && confirm('Удалить изображение?')) {
        deleteImage(id);
      }
    }
  });

  imageLayer.addEventListener('dblclick', (e) => {
    const img = e.target.closest('.layer-img');
    if (!img) return;
    
    e.stopPropagation();
    positionImageInCenter(img);
  });

  // Очистка ObjectURL при выгрузке
  window.addEventListener('beforeunload', () => {
    for (let id in images) {
      if (images[id].isObjectUrl) {
        URL.revokeObjectURL(images[id].imgElement.src);
      }
    }
  });

  // Активность инструментов
  const leftTools = document.getElementById('leftTools');

  // Обновление позиций при изменении размера окна
  window.addEventListener('resize', () => {
  Object.values(images).forEach(record => {
    const img = record.imgElement;
    const wrapper = record.wrapper; 

    const cx = parseFloat(wrapper.dataset.cx);
    const cy = parseFloat(wrapper.dataset.cy);

    const containerRect = imageLayer.getBoundingClientRect();

    if (!isNaN(cx) && !isNaN(cy)) {
      const newLeft = Math.max(0, Math.min(containerRect.width, cx));
      const newTop = Math.max(0, Math.min(containerRect.height, cy));

      wrapper.style.left = newLeft + 'px';
      wrapper.style.top = newTop + 'px';

      wrapper.dataset.cx = newLeft;
      wrapper.dataset.cy = newTop;
    }
  });
});
})();

(function() {
  const overlay = document.getElementById('welcomeOverlay');
  const closeBtn = document.getElementById('closeWelcomeBtn');
const closeBtn2 = document.getElementById('closeWelcomeBtn2');
  const mainContent = document.querySelector('main') || document.body; // или другой основной контейнер
  let previouslyFocused = null;

  function openModal() {
    previouslyFocused = document.activeElement;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    
    // Блокируем основной контент
    if (mainContent) {
      mainContent.classList.add('main-content-disabled');
      mainContent.setAttribute('aria-hidden', 'true');
    }
    
    document.body.style.overflow = 'hidden'; // запрет прокрутки фона// ставим фокус на кнопку закрытия
  }

  function closeModal() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    
    // Разблокируем основной контент
    if (mainContent) {
      mainContent.classList.remove('main-content-disabled');
      mainContent.setAttribute('aria-hidden', 'false');
    }
    
    document.body.style.overflow = '';
    
    // Возвращаем фокус на предыдущий элемент
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  // Закрыть при клике по затемненной области
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Клик по крестику
  closeBtn.addEventListener('click', closeModal);
  closeBtn2.addEventListener('click', closeModal);
  // Esc закрывает окно
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      closeModal();
    }
    
    // Trap focus внутри модального окна
    if (overlay.classList.contains('show') && e.key === 'Tab') {
      const focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      
      const focusArray = Array.from(focusables);
      const idx = focusArray.indexOf(document.activeElement);
      let next;
      
      if (e.shiftKey) {
        next = (idx <= 0) ? focusArray[focusArray.length - 1] : focusArray[idx - 1];
      } else {
        next = (idx === focusArray.length - 1) ? focusArray[0] : focusArray[idx + 1];
      }
      
      e.preventDefault();
      next.focus();
    }
  });

  // Автоматическое открытие при загрузке страницы
  window.addEventListener('load', function() {
    setTimeout(openModal, 200);
  });
})();
const mainContent = document.querySelector('main') || document.body;
let saveFolderPath = '';
let currentPatientName = '';
// Функция для обновления заголовка с ФИО пациента
function updatePatientHeader(name) {
  const headerDiv = document.querySelector('.header div:first-child');
  if (headerDiv) {
    headerDiv.textContent = `Пациент - ${name}`;
  }
}

// Загружаем последнее использованное имя из localStorage
const lastPatientName = localStorage.getItem('lastPatientName');
if (lastPatientName) {
  document.getElementById('patientName').value = lastPatientName;
  updatePatientHeader(lastPatientName);
}

// Сохраняем имя при вводе
document.getElementById('patientName').addEventListener('input', (e) => {
  const name = e.target.value.trim();
  if (name) {
    localStorage.setItem('lastPatientName', name);
    updatePatientHeader(name);
  }
});

window.activeImage = null;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("analysisForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Данные формы
    const scanType = document.querySelector("#shotTypeOptions .select-option.selected")?.dataset.value;
    const age = document.getElementById("patientAge").value;
    const ageUnit = document.getElementById("ageUnit").value;

    // Проверки
    if (!window.activeImage) {
      alert("Выберите снимок на канвасе");
      return;
    }
    if (!scanType) {
      alert("Выберите тип снимка");
      return;
    }

    if (!age) {
      alert("Введите возраст");
      return;
    }

    // Превращаем активное изображение в файл
    const activeImg = window.activeImage;
    const imagesMap = window.images;

    const record = imagesMap[activeImg.dataset.id];

    if (!record || !record.file) {
      alert("Файл не найден");
      return;
    }

    const file = record.file;

    // Формируем FormData для отправки на сервер
    const formData = new FormData();
    formData.append("file", file);
    formData.append("scan_type", scanType);
    formData.append("age", age);
    formData.append("age_unit", ageUnit);

    // Кнопка отправки
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Отправка...";

    try {
      const response = await fetch("/analyze", {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      console.log("Ответ сервера:", result);

      if (result.status === "ok") {
        alert(" Анализ завершён");
      } else {
        alert( result.message);
      }

      // Сброс формы
      form.reset();
      document.getElementById("selectedShotType").textContent = "Выберите тип";
      document.getElementById("selectedDiagnosis").textContent = "Выберите диагноз";
      document.getElementById("selectedImageName").textContent = "Не выбран";
      window.activeImage = null;

    } catch (err) {
      console.error(err);
      alert("Ошибка сервера");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Отправить на анализ";
    }
  });
});

function observeImageResize(img, canvas) {
  const observer = new ResizeObserver(() => {
    syncCanvasWithImage(img, canvas);
    redraw(canvas);
  });

  observer.observe(img);
}

function syncCanvasWithImage(img, canvas) {
  const w = img.clientWidth;
  const h = img.clientHeight;

  canvas.width = w;
  canvas.height = h;

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}

function loadServerAnalysis(data) {
  const canvas = window.activeImage ? window.activeImage.nextSibling : null;
  if (!canvas) return;

  // Очистим текущие рисования
  drawState.drawings = [];
  drawState.points = [];

  // 1️⃣ Добавляем линии (например, соединяем R_A → R_H, L_A → L_H)
  const pointMap = {};
  data.analysis.points.forEach(p => {
    pointMap[p.id] = { x: p.x / canvas.width, y: p.y / canvas.height, id: p.id, name: p.name };
  });

  // Правый ацетабулярный угол
  if (pointMap['R_A'] && pointMap['R_H']) {
    drawState.drawings.push({
      type: 'line',
      points: [pointMap['R_A'], pointMap['R_H']]
    });
  }

  // Левый ацетабулярный угол
  if (pointMap['L_A'] && pointMap['L_H']) {
    drawState.drawings.push({
      type: 'line',
      points: [pointMap['L_A'], pointMap['L_H']]
    });
  }

  // 2️⃣ Добавляем углы, если есть 3 точки (например, A, H и ещё какая-то)
  // Здесь можно расширить логику под реальные тройки
  // Пример:
  // drawState.drawings.push({ type: 'angle', points: [pointMap['R_A'], pointMap['R_H'], pointMap['SomePoint']] });

  // 3️⃣ Добавляем тексты
  data.analysis.texts.forEach(t => {
    const match = t.text.match(/(\d+\.?\d*)°/);
    const angleValue = match ? parseFloat(match[1]) : null;
    if (!angleValue) return;

    // Находим соответствующую точку (R_H или L_H)
    const targetId = t.text.includes('Правый') ? 'R_H' : 'L_H';
    const p = pointMap[targetId];
    if (!p) return;

    drawState.drawings.push({
      type: 'text',
      text: t.text,
      points: [p]
    });
  });

  redraw(canvas);
}
fetch('/analysis.json')
  .then(res => res.json())
  .then(data => loadServerAnalysis(data));

  function drawPointsFromServer(response, canvas) {
  if (!response || !response.points || !canvas) return;

  // Сбрасываем предыдущие точки/рисунки
  drawState.points = [];
  drawState.drawings = [];

  // Добавляем точки из JSON в drawState.points
  response.points.forEach(p => {
    drawState.points.push({
      x: p.x / canvas.width,  // нормализуем под canvas
      y: p.y / canvas.height,
      id: p.id,
      name: p.name
    });
  });

  // Перерисовываем
  redraw(canvas);
}

// Пример использования
fetch('/path/to/pred_all.json')
  .then(res => res.json())
  .then(data => {
    const canvas = document.querySelector('#yourCanvasId');
    drawPointsFromServer(data, canvas);
  });