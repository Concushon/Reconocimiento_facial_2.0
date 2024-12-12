const video = document.getElementById('inputVideo');
const canvas = document.getElementById('overlay');
const loadingElement = document.getElementById('loading');
document.getElementById("connect").addEventListener("click", connectToArduino);
document.getElementById("encender").addEventListener("click", () => sendCommand("1"));
document.getElementById("apagar").addEventListener("click", () => sendCommand("0"));

const MAX_RETRIES = 5;
let retryCount = 0;

async function loadFaceApiModels() {
    const MODEL_URL = './models';
    await Promise.all([
        faceapi.loadSsdMobilenetv1Model(MODEL_URL),
        faceapi.loadFaceLandmarkModel(MODEL_URL),
        faceapi.loadFaceRecognitionModel(MODEL_URL),
        faceapi.loadFaceExpressionModel(MODEL_URL),
    ]);
}

async function initFaceDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;

        await loadFaceApiModels();

        loadingElement.style.display = 'none';

        video.addEventListener('play', () => {
            resizeCanvasToVideo();
            detectFaces();
        });
        window.addEventListener('resize', resizeCanvasToVideo);
    } catch (err) {
        console.error("Error al iniciar la detección:", err);

        retryCount++;
        if (retryCount <= MAX_RETRIES) {
            console.log(`Reintentando cargar modelos... (${retryCount}/${MAX_RETRIES})`);
            setTimeout(initFaceDetection, 2000);
        } else {
            loadingElement.innerHTML = `<p>Error cargando modelos o accediendo a la webcam. Por favor, recarga la página.</p>`;
        }
    }
}

initFaceDetection();

let port;
let writer;
let arduinoConnected = false;

async function connectToArduino() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });

        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        console.log("¡Conexión exitosa con Arduino!");
        arduinoConnected = true;

        document.getElementById("encender").disabled = false;
        document.getElementById("apagar").disabled = false;
    } catch (error) {
        console.error("Error conectando con Arduino:", error);
        alert("No se pudo conectar con el Arduino. Verifica el navegador y el dispositivo.");
    }
}

function resizeCanvasToVideo() {
    const rect = video.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    canvas.style.position = 'absolute';
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
}

async function sendCommand(command) {
    if (writer) {
        await writer.write(command + "\n");
    } else {
        console.error("Conecta el Arduino antes de enviar comandos.");
    }
}

async function detectFaces() {
    const render = async () => {
        if (!video || video.paused || video.ended) return;

        const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withFaceExpressions();

        const dims = faceapi.matchDimensions(canvas, video, true);
        const resizedDetections = faceapi.resizeResults(detections, dims);

        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections, 0.05);

        if (arduinoConnected) {
            if (detections.length > 0) {
                detections.forEach(detection => {
                    if (detection.expressions.happy > 0.5) {
                        sendCommand("1");
                    } else {
                        sendCommand("0");
                    }
                });
            }
        }

        requestAnimationFrame(render);
    };

    render();
}
