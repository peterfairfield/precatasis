import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { TextureLoader } from 'three';

// Constants
const G = 6.67430e-11; // Gravitational constant
const SCALE = 1e-9; // Scale factor to make the simulation visually manageable
const VISUAL_SCALE = 1000; // Make celestial bodies appear 1000 times larger

class Simulation {
    constructor() {
        this.solarSystem = new SolarSystem();
        this.gui = new GUI();
        this.initGUI();
    }

    initGUI() {
        const simulationFolder = this.gui.addFolder('Simulation Controls');
        simulationFolder.add(this, 'resetSimulation').name('Reset Simulation');
        this.showOrbits = false;
        simulationFolder.add(this, 'showOrbits').name('Show Orbits').onChange(this.toggleOrbits.bind(this));
        simulationFolder.open();
    }

    toggleOrbits(value) {
        this.solarSystem.planets.forEach(planet => {
            if (value) {
                this.solarSystem.scene.add(planet.orbit);
            } else {
                this.solarSystem.scene.remove(planet.orbit);
            }
        });
    }

    resetSimulation() {
        this.solarSystem.planets.forEach(planet => planet.reset());
    }

    start() {
        this.solarSystem.start();
    }
}

class Sun {
    constructor() {
        this.mass = 1.9885e30; // Mass of the sun in kg
        const geometry = new THREE.SphereGeometry(6.9634e8 * SCALE, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, 0);
    }
}

class Planet {
    constructor(name, size, texturePath, distance, mass, initialVelocity, rotationSpeed) {
        this.name = name;
        this.size = size * VISUAL_SCALE; // Apply visual scaling to size
        this.distance = distance; // Distance from the sun in meters
        this.mass = mass; // Mass of the planet in kg
        this.initialVelocity = initialVelocity.clone(); // Initial velocity vector
        this.rotationSpeed = rotationSpeed; // Rotation speed in radians per second

        // Load texture
        const textureLoader = new TextureLoader();
        const texture = textureLoader.load(texturePath);

        // Create the planet mesh with texture
        const geometry = new THREE.SphereGeometry(this.size, 32, 32);
        const material = new THREE.MeshStandardMaterial({ map: texture });
        this.mesh = new THREE.Mesh(geometry, material);

        // Set initial position
        this.position = new THREE.Vector3(this.distance, 0, 0).multiplyScalar(SCALE);

        // Set initial velocity
        this.velocity = this.initialVelocity.clone().multiplyScalar(SCALE);

        // Create the orbit line for visualization
        this.orbit = this.createOrbit();

        // Add orbit path to the scene
        // This will be handled externally

        // Initialize trail geometry and material
        this.trailPoints = [];
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = new THREE.LineBasicMaterial({ color: this.color });
        this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
        this.trail.maxPoints = 1000; // Maximum number of trail points

        // Add trail to the scene (handled externally)
    }

    createOrbit() {
        const segments = 64;
        const orbitRadius = this.distance * SCALE;
        const orbitGeometry = new THREE.CircleGeometry(orbitRadius, segments);

        // Remove the center vertex by creating a new geometry without it
        // THREE.CircleGeometry generates a center vertex; we need only the perimeter
        const orbitVertices = [];
        const positionAttribute = orbitGeometry.attributes.position;

        for (let i = 1; i < positionAttribute.count; i++) {
            orbitVertices.push(
                positionAttribute.getX(i),
                positionAttribute.getY(i),
                positionAttribute.getZ(i)
            );
        }

        // Close the loop by adding the first perimeter vertex at the end
        orbitVertices.push(orbitVertices[0], orbitVertices[1], orbitVertices[2]);

        const orbitBufferGeometry = new THREE.BufferGeometry();
        orbitBufferGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(orbitVertices, 3)
        );

        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const orbit = new THREE.LineLoop(orbitBufferGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2; // Rotate to lie in the XZ plane

        return orbit;
    }

    updatePosition() {
        this.mesh.position.copy(this.position);
    }

    reset() {
        // Reset position and velocity to initial states
        this.position.set(this.distance * SCALE, 0, 0);
        this.velocity.copy(this.initialVelocity.clone().multiplyScalar(SCALE));
        this.updatePosition();
    }

    update(sun, delta) {
        // Vector from planet to sun
        const direction = new THREE.Vector3().subVectors(sun.mesh.position, this.position);
        const distance = direction.length() / SCALE; // Convert back to meters
        direction.normalize();

        // Calculate gravitational force magnitude: F = G * M * m / r^2
        const forceMagnitude = (G * sun.mass * this.mass) / (distance * distance);

        // Calculate acceleration: a = F / m = G * M / r^2
        const acceleration = direction.multiplyScalar(forceMagnitude / this.mass);

        // Update velocity: v = v + a * delta
        this.velocity.add(acceleration.multiplyScalar(delta * SCALE));

        // Update position: p = p + v * delta
        this.position.add(this.velocity.clone().multiplyScalar(delta));

        // Update rotation
        this.mesh.rotation.y += this.rotationSpeed * delta;

        // Update mesh position
        this.updatePosition();

        // Update planet's trail
        this.updateTrail();
    }

    updateTrail() {
        // Add current position to trail
        this.trailPoints.push(this.position.clone());
        if (this.trailPoints.length > this.trail.maxPoints) {
            this.trailPoints.shift();
        }

        // Update trail geometry
        const positions = [];
        this.trailPoints.forEach(point => {
            positions.push(point.x, point.y, point.z);
        });
        this.trailGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        );
        this.trailGeometry.needsUpdate = true;
    }
}

class SolarSystem {
    constructor() {
        // Set up the scene, camera, renderer, controls
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xF0F0F0, 1);
        this.scene.add(ambientLight);

        // Add point light (sun light)
        const pointLight = new THREE.PointLight(0xffffff, 2, 0);
        this.scene.add(pointLight);

        // Create the sun
        this.sun = new Sun();
        this.scene.add(this.sun.mesh);

        // Add skybox
        this.addSkybox();

        // Initialize planets
        this.initializePlanets();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Bind animation method
        this.animate = this.animate.bind(this);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1e15
        );
        this.camera.position.set(0, 5e8 * SCALE * 100, 1e10 * SCALE * 100);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
    }

    initializePlanets() {
        this.planets = [
            new Planet('Mercury', 2e6 * SCALE, 'textures/2k_mercury.jpg', 5.791e10, 3.3011e23, new THREE.Vector3(0, 4.74e4, 0), 0.000017),
            new Planet('Venus', 6.0518e6 * SCALE, 'textures/2k_venus_atmosphere.jpg', 1.082e11, 4.8675e24, new THREE.Vector3(0, 3.5e4, 0), 0.000004),
            new Planet('Earth', 6.371e6 * SCALE, 'textures/2k_earth_daymap.jpg', 1.496e11, 5.972e24, new THREE.Vector3(0, 2.978e4, 0), 0.000073),
            new Planet('Mars', 3.3895e6 * SCALE, 'textures/2k_mars.jpg', 2.279e11, 6.4171e23, new THREE.Vector3(0, 2.41e4, 0), 0.000070)
        ];

        this.planets.forEach(planet => {
            this.scene.add(planet.mesh);
            this.scene.add(planet.trail);
            planet.updatePosition();
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = 60 * 60; // Simulation time step in seconds (1 hour)

        // Update planet positions based on gravitational forces
        this.planets.forEach(planet => {
            planet.update(this.sun, delta);
        });

        // Update controls
        this.controls.update();

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }

    addSkybox() {
        const loader = new TextureLoader();
        const texture = loader.load('textures/2k_stars_milky_way.jpg');
        
        const skyboxGeometry = new THREE.SphereGeometry(1e15 * SCALE, 64, 64);
        const skyboxMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });
        
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        this.scene.add(skybox);
    }
}

// Initialize and start the solar system simulation
const simulation = new Simulation();
simulation.start();
