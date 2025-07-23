        // Scene setup
        const scene = new THREE.Scene();

        // Camera setup
        const camera = new THREE.PerspectiveCamera(49, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(60, 30, 60);
        camera.lookAt(0, 0, 0);

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5).normalize();
        scene.add(directionalLight);

        // Point light at sun position
        const pointLight = new THREE.PointLight(0xffffaa, 2, 300, 2);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        // Sun - spherical yellow with smooth glow
        const sunGeometry = new THREE.SphereGeometry(3, 64, 64);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF33 });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sun);

        // Glow using a custom shader sprite with radial gradient for smooth circular glow
        // We'll create a canvas texture with radial gradient for the glow

        function createGlowTexture() {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createRadialGradient(size/2, size/2, size/8, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255, 255, 150, 0.8)');
            gradient.addColorStop(0.4, 'rgba(255, 255, 150, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 150, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            return new THREE.CanvasTexture(canvas);
        }

        const glowTexture = createGlowTexture();

        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xffffaa,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.7
        });

        const sunGlow = new THREE.Sprite(glowMaterial);
        sunGlow.scale.set(20, 20, 1); // Larger than sun sphere for glow effect
        sun.add(sunGlow);

        // Planets data
        const planets = [
            { name: "Mercury", distance: 8, size: 0.5, color: 0xaaaaaa, speed: 0.02 },
            { name: "Venus", distance: 11, size: 0.7, color: 0xffcc00, speed: 0.015 },
            { name: "Earth", distance: 14, size: 0.8, color: 0x0000ff, speed: 0.01 },
            { name: "Mars", distance: 17, size: 0.6, color: 0xff4500, speed: 0.008 },
            { name: "Jupiter", distance: 22, size: 1.5, color: 0xffd700, speed: 0.005 },
            { name: "Saturn", distance: 28, size: 1.2, color: 0xe6e600, speed: 0.004 },
            { name: "Uranus", distance: 34, size: 1.0, color: 0x00ffff, speed: 0.003 },
            { name: "Neptune", distance: 40, size: 0.9, color: 0x00008b, speed: 0.002 }
        ];

        const planetMeshes = [];
        let saturnRing = null;

        planets.forEach(planet => {
            const geometry = new THREE.SphereGeometry(planet.size, 64, 64);
            const material = new THREE.MeshBasicMaterial({ color: planet.color });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.x = planet.distance;
            mesh.name = planet.name;
            scene.add(mesh);

            // Add rings to Saturn
            if (planet.name === "Saturn") {
                // Create ring geometry: a thin ring
                const ringInnerRadius = planet.size * 1.3;
                const ringOuterRadius = planet.size * 2.2;
                const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 64);
                ringGeometry.rotateX(-Math.PI / 2);

                // Create ring material with subtle color and transparency
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0xcccc99,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.5,
                    depthWrite: false
                });

                saturnRing = new THREE.Mesh(ringGeometry, ringMaterial);
                saturnRing.position.copy(mesh.position);
                scene.add(saturnRing);
            }

            // Orbit line
            const orbitCurve = new THREE.EllipseCurve(
                0, 0,
                planet.distance, planet.distance,
                0, 2 * Math.PI,
                false, 0
            );
            const points = orbitCurve.getPoints(100);
            const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
            const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
            const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
            scene.add(orbitLine);

            planetMeshes.push({ mesh: mesh, speed: planet.speed, distance: planet.distance, angle: Math.random() * Math.PI * 2 });
        });

        // Animation control
        let isPaused = false;
        const toggleBtn = document.getElementById('toggleAnimation');
        toggleBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            toggleBtn.textContent = isPaused ? 'Resume' : 'Pause';
            toggleBtn.setAttribute('aria-pressed', isPaused.toString());
        });

        // Speed controls linked to planets
        const speedControls = {
            Mercury: document.getElementById('mercury-speed'),
            Venus: document.getElementById('venus-speed'),
            Earth: document.getElementById('earth-speed'),
            Mars: document.getElementById('mars-speed'),
            Jupiter: document.getElementById('jupiter-speed'),
            Saturn: document.getElementById('saturn-speed'),
            Uranus: document.getElementById('uranus-speed'),
            Neptune: document.getElementById('neptune-speed')
        };

        // Initialize speed controls to 1 (multiplier)
        Object.values(speedControls).forEach(input => {
            input.value = 1;
        });

        // Clock for delta time
        const clock = new THREE.Clock();

        // Tooltip element
        const tooltip = document.getElementById('tooltip');

        // Raycaster and mouse vector for detecting hover
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Track currently hovered planet
        let hoveredPlanet = null;

        // Update tooltip position and content
        function updateTooltip(event) {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(planetMeshes.map(p => p.mesh));

            if (intersects.length > 0) {
                const intersected = intersects[0].object;
                if (hoveredPlanet !== intersected) {
                    hoveredPlanet = intersected;
                    tooltip.textContent = intersected.name;
                    tooltip.style.opacity = '1';
                    tooltip.setAttribute('aria-hidden', 'false');
                }
                // Position tooltip near mouse, offset so it doesn't cover pointer
                const tooltipWidth = tooltip.offsetWidth;
                const tooltipHeight = tooltip.offsetHeight;
                let left = event.clientX + 12;
                let top = event.clientY + 12;

                // Prevent tooltip from going off right edge
                if (left + tooltipWidth > window.innerWidth) {
                    left = event.clientX - tooltipWidth - 12;
                }
                // Prevent tooltip from going off bottom edge
                if (top + tooltipHeight > window.innerHeight) {
                    top = event.clientY - tooltipHeight - 12;
                }

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            } else {
                hoveredPlanet = null;
                tooltip.style.opacity = '0';
                tooltip.setAttribute('aria-hidden', 'true');
            }
        }

        // Hide tooltip on mouse leave canvas
        function hideTooltip() {
            hoveredPlanet = null;
            tooltip.style.opacity = '0';
            tooltip.setAttribute('aria-hidden', 'true');
        }

        renderer.domElement.addEventListener('mousemove', updateTooltip);
        renderer.domElement.addEventListener('mouseleave', hideTooltip);
        renderer.domElement.addEventListener('mouseout', hideTooltip);

        function animate() {
            requestAnimationFrame(animate);

            const delta = clock.getDelta();

            if (!isPaused) {
                sun.rotation.y += 0.2 * delta;

                planetMeshes.forEach((planet, i) => {
                    const planetName = planets[i].name;
                    const multiplier = parseFloat(speedControls[planetName].value) || 1;
                    planet.angle += planet.speed * multiplier * delta * 60;
                    planet.mesh.position.x = planet.distance * Math.cos(planet.angle);
                    planet.mesh.position.z = planet.distance * Math.sin(planet.angle);

                    // Update Saturn ring position to match Saturn
                    if (planetName === "Saturn" && saturnRing) {
                        saturnRing.position.copy(planet.mesh.position);
                    }
                });

                // Optional: slowly rotate the sun glow for subtle effect
                sunGlow.material.rotation += 0.01;
            }

            renderer.render(scene, camera);
        }

        animate();

        // Responsive resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
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
