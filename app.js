// Create main scene
const universe = new THREE.Scene();

// Configure camera
const spaceCamera = new THREE.PerspectiveCamera(49, window.innerWidth / window.innerHeight, 0.1, 1000);
spaceCamera.position.set(60, 30, 60);
spaceCamera.lookAt(0, 0, 0);

// Set up renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic lighting
universe.add(new THREE.AmbientLight(0xffffff, 0.5));

const sunlight = new THREE.DirectionalLight(0xffffff, 1);
sunlight.position.set(5, 5, 5).normalize();
universe.add(sunlight);

// Point light source at sun's center
const solarGlow = new THREE.PointLight(0xffffaa, 2, 300, 2);
solarGlow.position.set(0, 0, 0);
universe.add(solarGlow);

// Create Sun (core sphere)
const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(3, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffff33 })
);
universe.add(sunCore);

// Generate texture for glowing effect
function generateGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(128, 128, 32, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,150,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,150,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,150,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    return new THREE.CanvasTexture(canvas);
}

// Apply glow using a sprite
const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
        map: generateGlowTexture(),
        color: 0xffffaa,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.7
    })
);
glowSprite.scale.set(20, 20, 1);
sunCore.add(glowSprite);

// Define planet properties
const solarPlanets = [
    { name: "Mercury", radius: 8, scale: 0.5, tone: 0xaaaaaa, orbitSpeed: 0.02 },
    { name: "Venus", radius: 11, scale: 0.7, tone: 0xffcc00, orbitSpeed: 0.015 },
    { name: "Earth", radius: 14, scale: 0.8, tone: 0x0000ff, orbitSpeed: 0.01 },
    { name: "Mars", radius: 17, scale: 0.6, tone: 0xff4500, orbitSpeed: 0.008 },
    { name: "Jupiter", radius: 22, scale: 1.5, tone: 0xffd700, orbitSpeed: 0.005 },
    { name: "Saturn", radius: 28, scale: 1.2, tone: 0xe6e600, orbitSpeed: 0.004 },
    { name: "Uranus", radius: 34, scale: 1.0, tone: 0x00ffff, orbitSpeed: 0.003 },
    { name: "Neptune", radius: 40, scale: 0.9, tone: 0x00008b, orbitSpeed: 0.002 }
];

const planetaryBodies = [];
let saturnRings = null;

solarPlanets.forEach(planet => {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(planet.scale, 64, 64),
        new THREE.MeshBasicMaterial({ color: planet.tone })
    );
    sphere.position.x = planet.radius;
    sphere.name = planet.name;
    universe.add(sphere);

    // Add rings to Saturn
    if (planet.name === "Saturn") {
        const inner = planet.scale * 1.3;
        const outer = planet.scale * 2.2;
        const ring = new THREE.RingGeometry(inner, outer, 64);
        ring.rotateX(-Math.PI / 2);

        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xcccc99,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });

        saturnRings = new THREE.Mesh(ring, ringMat);
        saturnRings.position.copy(sphere.position);
        universe.add(saturnRings);
    }

    // Create orbit path
    const orbitPath = new THREE.EllipseCurve(
        0, 0, planet.radius, planet.radius, 0, Math.PI * 2
    );
    const pathPoints = orbitPath.getPoints(100);
    const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pathPoints.map(p => new THREE.Vector3(p.x, 0, p.y))),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
    );
    universe.add(orbitLine);

    planetaryBodies.push({
        mesh: sphere,
        speed: planet.orbitSpeed,
        radius: planet.radius,
        angle: Math.random() * Math.PI * 2
    });
});

// Pause/resume logic
let motionPaused = false;
const playPauseBtn = document.getElementById("toggleAnimation");
playPauseBtn.addEventListener("click", () => {
    motionPaused = !motionPaused;
    playPauseBtn.textContent = motionPaused ? "Resume" : "Pause";
    playPauseBtn.setAttribute("aria-pressed", motionPaused.toString());
});

// Speed sliders
const sliders = {};
["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].forEach(planet => {
    sliders[planet] = document.getElementById(`${planet.toLowerCase()}-speed`);
    sliders[planet].value = 1;
});

// Tooltip setup
const planetTooltip = document.getElementById("tooltip");
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hovered = null;

function updateTooltip(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, spaceCamera);
    const hits = raycaster.intersectObjects(planetaryBodies.map(p => p.mesh));

    if (hits.length > 0) {
        const obj = hits[0].object;
        if (hovered !== obj) {
            hovered = obj;
            planetTooltip.textContent = obj.name;
            planetTooltip.style.opacity = "1";
            planetTooltip.setAttribute("aria-hidden", "false");
        }

        let tipX = event.clientX + 12;
        let tipY = event.clientY + 12;
        const tipW = planetTooltip.offsetWidth;
        const tipH = planetTooltip.offsetHeight;

        if (tipX + tipW > window.innerWidth) tipX = event.clientX - tipW - 12;
        if (tipY + tipH > window.innerHeight) tipY = event.clientY - tipH - 12;

        planetTooltip.style.left = `${tipX}px`;
        planetTooltip.style.top = `${tipY}px`;
    } else {
        hovered = null;
        planetTooltip.style.opacity = "0";
        planetTooltip.setAttribute("aria-hidden", "true");
    }
}

renderer.domElement.addEventListener("mousemove", updateTooltip);
renderer.domElement.addEventListener("mouseleave", () => {
    hovered = null;
    planetTooltip.style.opacity = "0";
    planetTooltip.setAttribute("aria-hidden", "true");
});

// Animation loop
const clock = new THREE.Clock();
function renderScene() {
    requestAnimationFrame(renderScene);

    const delta = clock.getDelta();

    if (!motionPaused) {
        sunCore.rotation.y += 0.2 * delta;

        planetaryBodies.forEach((planet, index) => {
            const multiplier = parseFloat(sliders[solarPlanets[index].name].value) || 1;
            planet.angle += planet.speed * multiplier * delta * 60;
            planet.mesh.position.x = planet.radius * Math.cos(planet.angle);
            planet.mesh.position.z = planet.radius * Math.sin(planet.angle);

            if (solarPlanets[index].name === "Saturn" && saturnRings) {
                saturnRings.position.copy(planet.mesh.position);
            }
        });

        glowSprite.material.rotation += 0.01;
    }

    renderer.render(universe, spaceCamera);
}

renderScene();

// Window resize handler
window.addEventListener("resize", () => {
    spaceCamera.aspect = window.innerWidth / window.innerHeight;
    spaceCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
        // Hamburger toggle logic
const hamburgerBtn = document.getElementById('hamburger-btn');
 const controlPanel = document.getElementById('control-panel');

// Start minimized: control panel hidden, hamburger not open
controlPanel.classList.remove('open');
controlPanel.classList.add('minimized');
hamburgerBtn.classList.remove('open');
hamburgerBtn.setAttribute('aria-expanded', 'false');

hamburgerBtn.addEventListener('click', () => {
    const isOpen = controlPanel.classList.toggle('open');
    controlPanel.classList.toggle('minimized', !isOpen);
    hamburgerBtn.classList.toggle('open', isOpen);
    hamburgerBtn.setAttribute('aria-expanded', isOpen.toString());
});
