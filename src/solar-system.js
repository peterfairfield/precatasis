import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui'; // Import lil-gui

// Class representing a Planet
class Planet {
    constructor(name, size, distance, color, speed) {
        this.name = name;
        this.size = size;
        this.distance = distance;
        this.color = color;
        this.speed = speed;
        this.angle = Math.random() * Math.PI * 2;

        // Create the planet mesh
        const geometry = new THREE.SphereGeometry(this.size, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.updatePosition();

        // Create the orbit line
        const orbitGeometry = new THREE.CircleGeometry(this.distance, 64);
        // Remove the center vertex by using only the outer vertices
        const positions = orbitGeometry.attributes.position.array;
        const orbitPositions = [];

        for (let i = 0; i < positions.length; i += 3) {
            orbitPositions.push(positions[i], positions[i + 1], positions[i + 2]);
        }

        const orbitBufferGeometry = new THREE.BufferGeometry();
        orbitBufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPositions, 3));
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        this.orbit = new THREE.LineLoop(orbitBufferGeometry, orbitMaterial);
        this.orbit.rotation.x = Math.PI / 2; // Rotate to lie in the XZ plane
    }

    updatePosition() {
        this.mesh.position.set(
            this.distance * Math.cos(this.angle),
            0,
            this.distance * Math.sin(this.angle)
        );
    }

    update(delta, speedMultiplier) {
        this.angle += this.speed * delta * speedMultiplier;
        this.updatePosition();
    }
}

// Main Solar System Class
class SolarSystem {
    constructor() {
        // Set up the scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Set up the camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 50, 100);

        // Set up the renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Add point light (sun light)
        const pointLight = new THREE.PointLight(0xffffff, 1);
        this.scene.add(pointLight);

        // Create the sun
        const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);

        // Initialize planets
        this.planets = [
            new Planet('Mercury', 2, 15, 0xaaaaaa, 0.02),
            new Planet('Venus', 3, 25, 0xffa500, 0.015),
            new Planet('Earth', 3.5, 35, 0x0000ff, 0.01),
            new Planet('Mars', 2.8, 45, 0xff0000, 0.008)
        ];

        // Add planets and their orbits to the scene
        this.planets.forEach(planet => {
            this.scene.add(planet.mesh);
            this.scene.add(planet.orbit);
        });

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Initialize simulation speed
        this.speedMultiplier = 1;

        // Initialize GUI
        this.initGUI();
    }

    initGUI() {
        const gui = new GUI();
        const simulationFolder = gui.addFolder('Simulation Controls');

        simulationFolder
            .add(this, 'speedMultiplier', 0, 500, 0.1)
            .name('Speed')
            .onChange(value => {
                this.speedMultiplier = value;
            });

        simulationFolder.open();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const delta = 0.1;

        // Update planet positions with speed multiplier
        this.planets.forEach(planet => {
            planet.update(delta, this.speedMultiplier);
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }
}

// Initialize and start the solar system simulation
const solarSystem = new SolarSystem();
solarSystem.start();