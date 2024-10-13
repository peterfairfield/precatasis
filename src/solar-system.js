import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let sun, planets = [];

const G = 6.67430e-11; // Gravitational constant
const SCALE = 99; // Scale factor to make distances visible

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 100; // Increase camera distance

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.setClearColor(0xffffff, 1); // Set background to white
    document.body.appendChild(renderer.domElement);

    // Add AxesHelper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Add smooth damping effect
    controls.dampingFactor = 0.05;

    // Create sun
    const sunRadius = 5;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Create planets
    const planetColors = [0x3366ff, 0x66ff33, 0xff6633, 0x9933ff];
    for (let i = 0; i < 4; i++) {
        const distance = (i + 2) * 20; // Increase distance between planets
        const planetGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
        const planetMaterial = new THREE.MeshBasicMaterial({ color: planetColors[i] });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.x = distance;
        console.log(i, planet.position);
        planet.userData.velocity = new THREE.Vector3(0, Math.sqrt(G * sun.geometry.parameters.radius / (distance * SCALE)), 0);
        planet.userData.mass = sunRadius * 1e24; // Assign mass based on radius
        planets.push(planet);
        scene.add(planet);
    }

    // Add ambient light to make planets more visible
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    animate();
}

function updatePlanetPositions(delta) {
    planets.forEach(planet => {
        const distanceToSun = planet.position.length();
        const forceDirection = planet.position.clone().negate().normalize();
        const forceMagnitude = G * sun.userData.mass * planet.userData.mass / (distanceToSun * distanceToSun * SCALE * SCALE);
        const force = forceDirection.multiplyScalar(forceMagnitude);

        // Update velocity
        const acceleration = force.divideScalar(planet.userData.mass);
        planet.userData.velocity.add(acceleration.multiplyScalar(delta));

        // Update position
        planet.position.add(planet.userData.velocity.clone().multiplyScalar(delta / SCALE));
    });
}

function animate() {
    requestAnimationFrame(animate);

    const delta = 1 / 60; // Assume 60 FPS
    updatePlanetPositions(delta);

    controls.update(); // Update controls in the animation loop

    renderer.render(scene, camera);
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});
