import time
from adafruit_circuitplayground import cp

# How long (in seconds) we consider the system "shaking"
SHAKE_HOLD_TIME = 0.4

last_shake_time = 0

while True:
    temperature = cp.temperature
    light = cp.light

    # Detect shake event
    if cp.shake(shake_threshold=20):
        last_shake_time = time.monotonic()

    # Sustain shake state for a short window
    shaking = (time.monotonic() - last_shake_time) < SHAKE_HOLD_TIME

    shake_value = 1 if shaking else 0

    print(f"{temperature},{light},{shake_value}")
    time.sleep(0.05)
