// -----------------------------
// Serial variables
// -----------------------------
let port;
let reader;
let inputStream;
let serialBuffer = ""; // milliseconds (3 seconds)

let tempTarget = 20;
let tempSmooth = 20;

let blobHueSmooth = 160; // starting hue (doesn't matter much)


let lightTarget = 100;
let lightSmooth = 100;

let shake = 0;

const HUE_TRANSITION_TIME = 3000;
let blobs = [];
let energy = 0;

let currentTempZone = null;
const TEMP_HYSTERESIS = 0.6; // °C buffer


// UI
let connectBtn;

function tempToHue(tempC) {
  if (currentTempZone === null) {
    // Initialize zone on first run
    if (tempC < 18) currentTempZone = "cold";
    else if (tempC < 22) currentTempZone = "cool";
    else if (tempC < 26) currentTempZone = "warm";
    else currentTempZone = "hot";
  }

  switch (currentTempZone) {
    case "cold":
      if (tempC > 18 + TEMP_HYSTERESIS) currentTempZone = "cool";
      break;

    case "cool":
      if (tempC < 18 - TEMP_HYSTERESIS) currentTempZone = "cold";
      else if (tempC > 22 + TEMP_HYSTERESIS) currentTempZone = "warm";
      break;

    case "warm":
      if (tempC < 22 - TEMP_HYSTERESIS) currentTempZone = "cool";
      else if (tempC > 26 + TEMP_HYSTERESIS) currentTempZone = "hot";
      break;

    case "hot":
      if (tempC < 26 - TEMP_HYSTERESIS) currentTempZone = "warm";
      break;
  }

  // Map zones to hues
  if (currentTempZone === "cold") return 210;
  if (currentTempZone === "cool") return 160;
  if (currentTempZone === "warm") return 80;
  return 20;
}



function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  // Create blobs
  for (let i = 0; i < 30; i++) {
    blobs.push(new Blob());
  }

  // Connect button (p5)
  connectBtn = createButton("Connect CPX");
  connectBtn.position(16, 16);
  connectBtn.style("padding", "8px 12px");
  connectBtn.style("font-size", "14px");
  connectBtn.mousePressed(connectSerial);
}

// -----------------------------
// Web Serial Connection
// -----------------------------
async function connectSerial() {
  console.log("Connect button clicked");

  port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });

  const decoder = new TextDecoderStream();
  inputStream = port.readable.pipeTo(decoder.writable);
  reader = decoder.readable.getReader();

  connectBtn.hide();
  readLoop();
}

async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
      serialBuffer += value;

      let lines = serialBuffer.split("\n");
      serialBuffer = lines.pop(); // keep incomplete line

      for (let line of lines) {
        parseData(line);
      }
    }
  }
}


function parseData(data) {
  let values = data.trim().split(",");
  if (values.length !== 3) return;

  let t = float(values[0]);
  let l = float(values[1]);
  let s = int(values[2]);

  // Reject invalid readings
  if (isNaN(t) || isNaN(l) || isNaN(s)) return;

  // Clamp temperature to sane CPX range
  t = constrain(t, 0, 50);

  tempTarget = t;
  lightTarget = l;
  shake = s;

  console.log("Temp:", t, "Light:", l, "Shake:", s);
}


// -----------------------------
// DRAW LOOP
// -----------------------------
function draw() {
  // -----------------------------
  // Smooth sensor values
  // -----------------------------
  lightSmooth = lerp(lightSmooth, lightTarget, 0.05);
  tempSmooth = lerp(tempSmooth, tempTarget, 0.05);

  // -----------------------------
  // Background (light-driven)
  // -----------------------------
  let bgHue = 220; // ambient cool base
  let bgBrightness = map(lightSmooth, 0, 320, 15, 100);
  let bgSat = map(lightSmooth, 0, 320, 40, 15);
  background(bgHue, bgSat, bgBrightness);

  // -----------------------------
  // Blob color (DISCRETE temp zones)
  // -----------------------------
  // Get target hue from discrete temperature zones
// Target hue from discrete temperature zones
let targetHue = tempToHue(tempSmooth);

// Time-based smoothing (3 seconds)
let hueDiff = ((targetHue - blobHueSmooth + 540) % 360) - 180;

// How much to move this frame (based on elapsed time)
let step = (deltaTime / HUE_TRANSITION_TIME);
step = constrain(step, 0, 1);

// Apply smoothing
blobHueSmooth = (blobHueSmooth + hueDiff * step + 360) % 360;



  let blobBrightness = map(lightSmooth, 0, 320, 90, 55);
  let blobSaturation = map(lightSmooth, 0, 320, 90, 70);

  // -----------------------------
  // Motion energy (sustained shake)
  // -----------------------------
  if (shake === 1) {
    energy = 60;
  } else {
    energy = max(energy * 0.9, 0);
  }

  // -----------------------------
  // Draw blobs
  // -----------------------------
  for (let blob of blobs) {
    blob.update(energy);
    blob.display(blobHueSmooth, blobSaturation, blobBrightness);

  }

  // -----------------------------
  // HUD overlay
  // -----------------------------
  drawHUD();
}


// -----------------------------
// Blob Class
// -----------------------------
class Blob {
  constructor() {
    this.x = random(width);
    this.y = random(height);

    this.vx = 0;
    this.vy = 0;

    this.baseSize = random(80, 250); // 👈 MUCH bigger
    this.sizeOffset = random(1000);  // for breathing
    this.noiseOffset = random(1000); // for shape
  }

  update(energy) {
    let force = map(energy, 0, 50, 0.02, 0.8);

    this.vx += random(-force, force);
    this.vy += random(-force, force);

    // Damping for smooth motion
    this.vx *= 0.9;
    this.vy *= 0.9;

    this.x += this.vx;
    this.y += this.vy;

    this.x = constrain(this.x, 0, width);
    this.y = constrain(this.y, 0, height);
    this.noiseOffset += map(energy, 0, 60, 0.001, 0.02);

  }

    display(hue) {
    noStroke();
    fill(hue, 80, 90, 35);

    push();
    translate(this.x, this.y);

    beginShape();
    let points = 20; // higher = smoother blob

    for (let i = 0; i < points; i++) {
      let angle = map(i, 0, points, 0, TWO_PI);

      // Organic radius using Perlin noise
      let n = noise(
        cos(angle) + this.noiseOffset,
        sin(angle) + this.noiseOffset
      );

      // Breathing effect
      let breathe = sin(frameCount * 0.02 + this.sizeOffset) * 10;

      let radius =
        this.baseSize * 0.5 +
        n * this.baseSize * 0.4 +
        breathe;

      let x = cos(angle) * radius;
      let y = sin(angle) * radius;

      curveVertex(x, y);
    }

    endShape(CLOSE);
    pop();

    // Slowly evolve shape
    this.noiseOffset += 0.003;
  }

}

// -----------------------------
// Handle window resizing
// -----------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function cToF(celsius) {
  return (celsius * 9) / 5 + 32;
}

function drawHUD() {
  push();

  // Layout
//   let padding = 16;
//   let lineHeight = 24;
//   let boxWidth = 300;
//   let boxHeight = 120;

//   let x = width - boxWidth - padding;
//   let y = padding;

//   // Background panel
//   noStroke();
//   fill(0, 0, 0, 65);
//   rect(x, y, boxWidth, boxHeight, 12);

//   // Text styling
//   fill(0, 0, 100);
//   textSize(18);
//   textAlign(LEFT, TOP);

//   // Values
//   let tempF = cToF(tempTarget).toFixed(1);
//   let tempFSmooth = cToF(tempSmooth).toFixed(1);

//   text(
//     `Light: ${lightTarget.toFixed(0)} `,
//     x + padding,
//     y + padding
//   );

//   text(
//     `Temp: ${tempF}°F `,
//     x + padding,
//     y + padding + lineHeight
//   );

//   text(
//     `Shake: ${shake === 1 ? "TRUE" : "FALSE"}`,
//     x + padding,
//     y + padding + lineHeight * 2
//   );

//   pop();
}
