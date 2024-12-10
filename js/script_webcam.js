const video = document.getElementById('inputVideo');
const canvas = document.getElementById('overlay');
const loadingElement = document.getElementById('loading');

(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;

        const MODEL_URL = './models';
        await Promise.all([
            faceapi.loadSsdMobilenetv1Model(MODEL_URL),
            faceapi.loadFaceLandmarkModel(MODEL_URL),
            faceapi.loadFaceRecognitionModel(MODEL_URL),
            faceapi.loadFaceExpressionModel(MODEL_URL),
        ]);

        loadingElement.style.display = 'none';

        video.addEventListener('play', () => {
            resizeCanvasToVideo();
            detectFaces();
        });
        window.addEventListener('resize', resizeCanvasToVideo);
    } catch (err) {
        console.error("Error al iniciar la detección:", err);
        loadingElement.innerHTML = `<p>Error cargando modelos o accediendo a la webcam.</p>`;
    }
})();

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

        requestAnimationFrame(render);
    };

    render();
}