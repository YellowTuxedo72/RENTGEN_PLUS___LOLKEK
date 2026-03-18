from app.handlers.pelvis_handler import PelvisHandler

HANDLERS = {
    "pelvis": PelvisHandler(),
}

def get_handler(task: str):
    return HANDLERS.get(task)