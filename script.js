// ----- Simulation Parameters -----
const baseDt = 0.05; // Base time step (seconds)

// ----- Global Variables -----
let positionChart, velocityChart;
let animationId = null;
let simTime = 0;
let paused = false;
let hasReset = false;
let speedFactor = 1.0; // Multiplies baseDt
const colorPalette = ["red","cyan","lime","yellow","magenta","orange"];

// Each object in the simulation is stored in this array
// Example structure:
// objects = [
//   {
//     id: 0,
//     color: "red",
//     initialPosition: 0,
//     initialVelocity: 0,
//     accelerationEvents: [ {acc: 0, dur: 1}, ... ],
//     currentEventIndex: 0,
//     timeInEvent: 0,
//     position: 0,
//     velocity: 0,
//     timeData: [],
//     positionData: [],
//     velocityData: []
//   },
//   ...
// ]
let objects = [];

window.onload = function() {
  initCharts();
  initEventListeners();
  // Create one object by default
  addObject();
};

function initCharts() {
  const positionCtx = document.getElementById("positionChart").getContext("2d");
  positionChart = new Chart(positionCtx, {
    type: "scatter",
    data: { datasets: [] },
    options: {
      animation: false,
      scales: {
        x: {
          title: { display: true, text: "Time (s)" },
          grid: { color: "#444" },
          ticks: { color: "#ccc" },
          min: 0,
          max: 10 // updated dynamically
        },
        y: {
          title: { display: true, text: "Position (m)" },
          grid: { color: "#444" },
          ticks: { color: "#ccc" }
        }
      },
      plugins: {
        legend: { labels: { color: "#ccc" } }
      }
    }
  });

  const velocityCtx = document.getElementById("velocityChart").getContext("2d");
  velocityChart = new Chart(velocityCtx, {
    type: "scatter",
    data: { datasets: [] },
    options: {
      animation: false,
      scales: {
        x: {
          title: { display: true, text: "Time (s)" },
          grid: { color: "#444" },
          ticks: { color: "#ccc" },
          min: 0,
          max: 10 // updated dynamically
        },
        y: {
          title: { display: true, text: "Velocity (m/s)" },
          grid: { color: "#444" },
          ticks: { color: "#ccc" }
        }
      },
      plugins: {
        legend: { labels: { color: "#ccc" } }
      }
    }
  });
}

function initEventListeners() {
  document.getElementById("addObjectBtn").addEventListener("click", addObject);
  document.getElementById("playBtn").addEventListener("click", playSimulation);
  document.getElementById("pauseBtn").addEventListener("click", pauseSimulation);
  document.getElementById("resetBtn").addEventListener("click", resetSimulation);

  // Speed slider
  const speedSlider = document.getElementById("speedSlider");
  const speedLabel = document.getElementById("speedLabel");
  speedSlider.addEventListener("input", () => {
    speedFactor = parseFloat(speedSlider.value);
    speedLabel.textContent = speedFactor.toFixed(1) + "x";
  });
}

// ----- Object Management -----
function addObject() {
  const objId = objects.length; // use array length as ID
  const objColor = colorPalette[objId % colorPalette.length] || randomColor();

  const objectData = {
    id: objId,
    color: objColor,
    initialPosition: 0,
    initialVelocity: 0,
    accelerationEvents: [],
    currentEventIndex: 0,
    timeInEvent: 0,
    position: 0,
    velocity: 0,
    timeData: [],
    positionData: [],
    velocityData: []
  };

  objects.push(objectData);
  createObjectUI(objectData);
}

function createObjectUI(obj) {
  const container = document.getElementById("objectsContainer");
  const objectDiv = document.createElement("div");
  objectDiv.classList.add("objectContainer");
  objectDiv.id = `objectContainer-${obj.id}`;

  objectDiv.innerHTML = `
    <div class="objectHeader">
      <span class="objectTitle" style="color:${obj.color}">Object ${obj.id + 1}</span>
      <button class="deleteObjectBtn">Delete Object</button>
    </div>
    <div class="objectControls">
      <label>Initial Position (m): </label>
      <input type="number" class="initialPosition" value="0" step="any">
      <label>Initial Velocity (m/s): </label>
      <input type="number" class="initialVelocity" value="0" step="any">

      <h2>Acceleration Events</h2>
      <div class="accEvents"></div>
      <button class="addEventBtn">Add Event</button>
    </div>
  `;

  container.appendChild(objectDiv);

  // Event: Delete object
  const deleteBtn = objectDiv.querySelector(".deleteObjectBtn");
  deleteBtn.addEventListener("click", () => {
    deleteObject(obj.id);
  });

  // Event: Add acceleration event
  const addEventBtn = objectDiv.querySelector(".addEventBtn");
  addEventBtn.addEventListener("click", () => {
    addAccelerationEvent(obj.id);
  });

  // Add one default event
  addAccelerationEvent(obj.id);
}

function deleteObject(objId) {
  // Remove from objects array
  objects = objects.filter(o => o.id !== objId);

  // Remove DOM element
  const container = document.getElementById(`objectContainer-${objId}`);
  if (container) container.remove();

  // Re-index if desired, but simplest is to leave IDs in place
}

function addAccelerationEvent(objId) {
  const objDiv = document.getElementById(`objectContainer-${objId}`);
  if (!objDiv) return;

  const accEventsDiv = objDiv.querySelector(".accEvents");
  const eventDiv = document.createElement("div");
  eventDiv.className = "accEvent";
  eventDiv.innerHTML = `
    <label>Acc (m/s²):</label>
    <input type="number" class="accValue" value="0" step="any">
    <label>Duration (s):</label>
    <input type="number" class="accDuration" value="1" step="any">
    <button class="deleteEventBtn">Delete</button>
  `;
  accEventsDiv.appendChild(eventDiv);

  // Add event listener to delete
  const deleteBtn = eventDiv.querySelector(".deleteEventBtn");
  deleteBtn.addEventListener("click", () => {
    eventDiv.remove();
  });
}

function gatherInputs() {
  // Reset objects to initial states
  objects.forEach(obj => {
    const objDiv = document.getElementById(`objectContainer-${obj.id}`);
    if (!objDiv) return;

    // Gather initial position/velocity
    const initPosInput = objDiv.querySelector(".initialPosition");
    const initVelInput = objDiv.querySelector(".initialVelocity");
    obj.initialPosition = parseFloat(initPosInput.value) || 0;
    obj.initialVelocity = parseFloat(initVelInput.value) || 0;

    // Gather acceleration events
    obj.accelerationEvents = [];
    const accEventDivs = objDiv.querySelectorAll(".accEvent");
    accEventDivs.forEach(div => {
      const acc = parseFloat(div.querySelector(".accValue").value) || 0;
      const dur = parseFloat(div.querySelector(".accDuration").value) || 0;
      if (dur > 0) {
        obj.accelerationEvents.push({ acc, dur });
      }
    });

    // Initialize dynamic properties
    obj.currentEventIndex = 0;
    obj.timeInEvent = 0;
    obj.position = obj.initialPosition;
    obj.velocity = obj.initialVelocity;
    obj.timeData = [];
    obj.positionData = [];
    obj.velocityData = [];
  });
}

// ----- Simulation Control -----
function playSimulation() {
  if (!paused || hasReset) {
    gatherInputs();
    if (objects.length === 0) return;

    clearChartData();
    simTime = 0;
    hasReset = false;

    // Determine total time from all objects
    // (We'll use max among objects to scale the chart axes)
    let overallMaxTime = 0;
    let allPositions = [];
    objects.forEach(obj => {
      const sumDur = obj.accelerationEvents.reduce((acc, e) => acc + e.dur, 0);
      if (sumDur > overallMaxTime) {
        overallMaxTime = sumDur;
      }
    });

    // Pre-plot or gather min/max for scaling
    // We can do a rough approach: just guess that the max will not exceed
    //  some moderate range, or do a pass to precompute. We'll do a quick pass:
    let globalMinPos = Infinity, globalMaxPos = -Infinity;
    const preDt = 0.02; 
    objects.forEach(obj => {
      let tempPos = obj.initialPosition;
      let tempVel = obj.initialVelocity;
      let timeAccum = 0;

      obj.accelerationEvents.forEach(event => {
        const steps = Math.ceil(event.dur / preDt);
        for (let i = 0; i < steps; i++) {
          tempVel += event.acc * preDt;
          tempPos += tempVel * preDt;
          timeAccum += preDt;
          allPositions.push(tempPos);
        }
      });
    });

    if (allPositions.length > 0) {
      globalMinPos = Math.min(...allPositions);
      globalMaxPos = Math.max(...allPositions);
    } else {
      globalMinPos = 0;
      globalMaxPos = 1;
    }

    const posBuffer = 0.1 * Math.abs(globalMaxPos - globalMinPos || 1);
    positionChart.options.scales.x.min = 0;
    positionChart.options.scales.x.max = overallMaxTime * 1.1; // 10% buffer
    positionChart.options.scales.y.min = globalMinPos - posBuffer;
    positionChart.options.scales.y.max = globalMaxPos + posBuffer;

    velocityChart.options.scales.x.min = 0;
    velocityChart.options.scales.x.max = overallMaxTime * 1.1;

    positionChart.update();
    velocityChart.update();
  }

  paused = false;
  requestFrameUpdate();
}

function pauseSimulation() {
  paused = true;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function resetSimulation() {
  pauseSimulation();
  clearChartData();
  simTime = 0;
  hasReset = true;
}

function updateSimulation() {
  // For each object, update based on current event
  let allDone = true;
  //const effectiveDt = baseDt * speedFactor;
  const effectiveDt = baseDt;

  objects.forEach(obj => {
    if (obj.currentEventIndex < obj.accelerationEvents.length) {
      allDone = false; // At least one object is still running
      const currentEvent = obj.accelerationEvents[obj.currentEventIndex];
      const acc = currentEvent.acc;

      // Update motion
      obj.velocity += acc * effectiveDt;
      obj.position += obj.velocity * effectiveDt;

      // Track time
      obj.timeInEvent += effectiveDt;

      // If the object has finished this event, move to next
      if (obj.timeInEvent >= currentEvent.dur) {
        obj.currentEventIndex++;
        obj.timeInEvent = 0;
      }

      // Save data for plotting
      obj.timeData.push(simTime);
      obj.positionData.push(obj.position);
      obj.velocityData.push(obj.velocity);
    }
  });

  // If all objects have completed their events, stop
  if (allDone) {
    pauseSimulation();
    return;
  }

  // Update global sim time
  simTime += effectiveDt;
  updateCharts();
}

function requestFrameUpdate() {
  if (!paused) {
    updateSimulation();
    animationId = requestAnimationFrame(requestFrameUpdate);
  }
}

// ----- Chart Handling -----
function updateCharts() {
  // Rebuild dataset arrays for each chart
  // Position chart
  positionChart.data.datasets = objects.map((obj, i) => ({
    label: `Object ${i + 1}`,
    data: obj.timeData.map((t, idx) => ({ x: t, y: obj.positionData[idx] })),
    showLine: true,
    borderColor: obj.color,
    backgroundColor: obj.color,
    pointRadius: 2
  }));

  positionChart.update();

  // Velocity chart
  velocityChart.data.datasets = objects.map((obj, i) => ({
    label: `Object ${i + 1}`,
    data: obj.timeData.map((t, idx) => ({ x: t, y: obj.velocityData[idx] })),
    showLine: true,
    borderColor: obj.color,
    backgroundColor: obj.color,
    pointRadius: 2
  }));

  velocityChart.update();
}

function clearChartData() {
  objects.forEach(obj => {
    obj.timeData = [];
    obj.positionData = [];
    obj.velocityData = [];
  });

  positionChart.data.datasets = [];
  velocityChart.data.datasets = [];
  positionChart.update();
  velocityChart.update();
}

// Fallback for more colors if needed
function randomColor() {
  return "#" + Math.floor(Math.random()*16777215).toString(16);
}
