import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let sun, planets = [];
let planetTrails = []; // New array to store planet trails

const G = 6.67430e-11; // Gravitational constant
const SCALE = 1e12; // Greatly increased scale factor to slow down the simulation
const TIME_STEP = 1 / 60; // Time step for update (60 FPS)
const MAX_FORCE = 1e-4; // Maximum force to prevent extreme accelerations
const TRAIL_LENGTH = 1000; // Number of points in each trail

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 200);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1); // Set background to black for better contrast
    document.body.appendChild(renderer.domElement);

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Create sun
    const sunRadius = 10;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.userData.mass = sunRadius * 1e30;
    scene.add(sun);

    // Add a point light at the sun's position
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 0);
    sun.add(pointLight);

    // Optionally, add more ambient light for subtle illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Create planets with random positions
    const planetColors = [0x3366ff, 0x66ff33, 0xff6633, 0x9933ff];
    for (let i = 0; i < 4; i++) {
        const planetRadius = 2 + Math.random() * 2; // Random size between 2 and 4
        const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
        const planetMaterial = new THREE.MeshPhongMaterial({ color: planetColors[i] });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);

        // Random distance from sun between 30 and 100
        const distance = 30 + Math.random() * 70;
        
        // Random angle around the sun
        const angle = Math.random() * Math.PI * 2;
        
        // Set random position
        planet.position.x = Math.cos(angle) * distance;
        planet.position.z = Math.sin(angle) * distance;
        planet.position.y = (Math.random() - 0.5) * 20; // Random Y between -10 and 10

        // Calculate orbital velocity (perpendicular to position vector)
        const speed = Math.sqrt(G * sun.userData.mass / (distance * SCALE)) * 0.1; // Reduced initial velocity
        planet.userData.velocity = new THREE.Vector3(
            -Math.sin(angle) * speed,
            0,
            Math.cos(angle) * speed
        );

        planet.userData.mass = planetRadius * 1e24;
        planets.push(planet);
        scene.add(planet);

        // Create trail for the planet
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(TRAIL_LENGTH * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trailMaterial = new THREE.LineBasicMaterial({ color: planetColors[i], opacity: 0.5, transparent: true });
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        planetTrails.push(trail);

        // Create and add orbit line
        createOrbitLine(planet);
    }

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    animate();
}

function createAxesHelperWithTicks(axisLength, tickSpacing) {
    const axesGroup = new THREE.Group();

    // Create standard AxesHelper
    const axesHelper = new THREE.AxesHelper(axisLength);
    axesGroup.add(axesHelper);

    // Create tick marks
    const tickMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const tickSize = 1;

    for (let axis = 0; axis < 3; axis++) {
        for (let i = tickSpacing; i <= axisLength; i += tickSpacing) {
            const tickGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array(6);

            // Set tick position
            vertices[axis * 2] = axis === 0 ? i : 0;
            vertices[axis * 2 + 1] = axis === 1 ? i : 0;
            vertices[axis * 2 + 2] = axis === 2 ? i : 0;

            // Set tick size
            vertices[3] = axis === 0 ? i : (axis === 1 ? tickSize : 0);
            vertices[4] = axis === 1 ? i : (axis === 0 ? tickSize : 0);
            vertices[5] = axis === 2 ? i : tickSize;

            tickGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const tick = new THREE.Line(tickGeometry, tickMaterial);
            axesGroup.add(tick);
        }
    }

    return axesGroup;
}

function updatePlanetPositions(delta) {
    planets.forEach((planet, index) => {
        const distanceToSun = planet.position.distanceTo(sun.position);
        const forceDirection = sun.position.clone().sub(planet.position).normalize();
        let forceMagnitude = G * sun.userData.mass * planet.userData.mass / (distanceToSun * distanceToSun);
        
        // Limit the force magnitude
        forceMagnitude = Math.min(forceMagnitude, MAX_FORCE);
        
        const force = forceDirection.multiplyScalar(forceMagnitude);

        // Update velocity
        const acceleration = force.divideScalar(planet.userData.mass);
        planet.userData.velocity.add(acceleration.multiplyScalar(delta));

        // Update position
        const positionDelta = planet.userData.velocity.clone().multiplyScalar(delta / SCALE);
        planet.position.add(positionDelta);

        // Update trail
        const trail = planetTrails[index];
        const positions = trail.geometry.attributes.position.array;
        
        // Shift all positions back by one
        for (let i = positions.length - 1; i > 2; i--) {
            positions[i] = positions[i - 3];
        }
        
        // Add current position to the front
        positions[0] = planet.position.x;
        positions[1] = planet.position.y;
        positions[2] = planet.position.z;
        
        trail.geometry.attributes.position.needsUpdate = true;
    });
}

function animate() {
    requestAnimationFrame(animate);

    updatePlanetPositions(TIME_STEP);

    // Log planet positions
    planets.forEach((planet, index) => {
        console.log(`Planet ${index + 1} position:`, 
            `X: ${planet.position.x.toFixed(2)}`,
            `Y: ${planet.position.y.toFixed(2)}`,
            `Z: ${planet.position.z.toFixed(2)}`
        );
    });

    controls.update();
    renderer.render(scene, camera);
}

function createOrbitLine(planet) {
    const orbitRadius = planet.position.length();
    const segments = 360;
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitPositions = new Float32Array((segments + 1) * 3);

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        orbitPositions[i * 3] = Math.cos(theta) * orbitRadius;
        orbitPositions[i * 3 + 1] = 0; // Assuming orbits lie on the XZ plane
        orbitPositions[i * 3 + 2] = Math.sin(theta) * orbitRadius;
    }

    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
    const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);

    scene.add(orbitLine);
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});