import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import {
  AlertTriangle,
  Compass,
  Eye,
  Flame,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button, StatusSignal } from "../ui/Primitives";
import { SensorDTO, BuildingDetailDTO } from "../dashboard/MainDashboard";

/* ============================================================================
 * ZONE & ROOM DEFINITIONS FOR PROCEDURAL 3D BUILDING
 * ============================================================================ */
export interface ArchitecturalZone {
  id: string;
  code: string;
  name: string;
  floor: number;
  type: "LOBBY" | "SERVER" | "ELECTRICAL" | "OFFICE" | "STAIRS" | "CORRIDOR" | "HVAC";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  bounds: { x: number; z: number; width: number; depth: number };
  color: number;
  hasAlarm?: boolean;
}

const PROCEDURAL_ZONES: ArchitecturalZone[] = [
  // --- FLOOR 1 (Ground level, Y ~ 0) ---
  {
    id: "f1-lobby",
    code: "Z-101",
    name: "Главный вестибюль и входная группа",
    floor: 1,
    type: "LOBBY",
    riskLevel: "LOW",
    bounds: { x: -6, z: -4, width: 10, depth: 8 },
    color: 0xe8e6df,
  },
  {
    id: "f1-dispatch",
    code: "Z-102",
    name: "Центральный диспетчерский пункт",
    floor: 1,
    type: "SERVER",
    riskLevel: "MEDIUM",
    bounds: { x: 5, z: -4, width: 5, depth: 5 },
    color: 0xdcdad4,
  },
  {
    id: "f1-stairs",
    code: "STAIR-1",
    name: "Эвакуационный лестничный узел Юг",
    floor: 1,
    type: "STAIRS",
    riskLevel: "LOW",
    bounds: { x: 5, z: 2, width: 5, depth: 3 },
    color: 0xc8c6bf,
  },

  // --- FLOOR 2 (Level 2, Y ~ 4) ---
  {
    id: "f2-server",
    code: "Z-201",
    name: "Центральная серверная (ЦОД)",
    floor: 2,
    type: "SERVER",
    riskLevel: "CRITICAL",
    bounds: { x: -6, z: -4, width: 6, depth: 6 },
    color: 0xd0cfc9,
  },
  {
    id: "f2-power",
    code: "Z-202",
    name: "Главная электрощитовая подстанция",
    floor: 2,
    type: "ELECTRICAL",
    riskLevel: "HIGH",
    bounds: { x: 1, z: -4, width: 5, depth: 6 },
    color: 0xc8c7c1,
  },
  {
    id: "f2-corridor",
    code: "Z-203",
    name: "Коридор и переходная галерея",
    floor: 2,
    type: "CORRIDOR",
    riskLevel: "LOW",
    bounds: { x: -6, z: 3, width: 10, depth: 2 },
    color: 0xdedcd6,
  },
  {
    id: "f2-stairs",
    code: "STAIR-2",
    name: "Эвакуационный лестничный узел Юг",
    floor: 2,
    type: "STAIRS",
    riskLevel: "LOW",
    bounds: { x: 5, z: 2, width: 5, depth: 3 },
    color: 0xc8c6bf,
  },

  // --- FLOOR 3 (Level 3, Y ~ 8) ---
  {
    id: "f3-office",
    code: "Z-301",
    name: "Инженерный опенспейс и рабочие станции",
    floor: 3,
    type: "OFFICE",
    riskLevel: "LOW",
    bounds: { x: -6, z: -4, width: 8, depth: 6 },
    color: 0xe0ded8,
  },
  {
    id: "f3-hvac",
    code: "Z-302",
    name: "Венткамера и узел пожаротушения",
    floor: 3,
    type: "HVAC",
    riskLevel: "HIGH",
    bounds: { x: 3, z: -4, width: 4, depth: 6 },
    color: 0xcfcbc3,
  },
  {
    id: "f3-stairs",
    code: "STAIR-3",
    name: "Лестничный узел с выходом на кровлю",
    floor: 3,
    type: "STAIRS",
    riskLevel: "LOW",
    bounds: { x: 5, z: 2, width: 5, depth: 3 },
    color: 0xc8c6bf,
  },
];

interface DigitalTwinViewProps {
  building: BuildingDetailDTO | null;
  sensors: SensorDTO[];
  onRefresh?: () => void;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  building,
  sensors,
  onRefresh,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Interaction States
  const [selectedFloor, setSelectedFloor] = useState<number | "ALL">("ALL");
  const [selectedZone, setSelectedZone] = useState<ArchitecturalZone | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<SensorDTO | null>(null);
  const [simulatedAlarm, setSimulatedAlarm] = useState<boolean>(false);
  const [explodedView, setExplodedView] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Mesh reference groups for dynamic manipulation
  const floorGroupsRef = useRef<Map<number, THREE.Group>>(new Map());
  const zoneMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const sensorMarkersRef = useRef<Array<{ mesh: THREE.Group; sensor: SensorDTO }>>([]);
  const alarmLightRef = useRef<THREE.PointLight | null>(null);

  // Camera Orbit parameters
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6, radius: 36 });

  // Compute active alarms and warnings from real sensors + simulated alarm
  const activeAlarms = useMemo(() => {
    const list = sensors.filter((s) => s.status === "ALARM");
    if (simulatedAlarm) {
      list.push({
        id: 999,
        code: "SN-201-SIM",
        name: "Датчик температуры Серверная (СИМУЛЯЦИЯ)",
        sensor_type: "HEAT",
        status: "ALARM",
        pos_x: -3.0,
        pos_y: 5.5,
        pos_z: -1.0,
        battery_level: 95.0,
        signal_strength: 92.0,
        latest_reading: {
          metric_type: "TEMPERATURE",
          value: 78.5,
          unit: "°C",
        },
      });
    }
    return list;
  }, [sensors, simulatedAlarm]);

  /* ==========================================================================
   * CAMERA POSITION UPDATE
   * ========================================================================== */
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngleRef.current;
    const clampedPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));

    const x = radius * Math.cos(clampedPhi) * Math.sin(theta);
    const y = radius * Math.sin(clampedPhi) + 4;
    const z = radius * Math.cos(clampedPhi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 4, 0);
  }, []);

  /* ==========================================================================
   * INITIALIZE THREE.JS SCENE
   * ========================================================================== */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x17181a); // Industrial dark viewport
    scene.fog = new THREE.FogExp2(0x17181a, 0.015);

    // 2. Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 200);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    scene.add(dirLight);

    const secondaryFill = new THREE.DirectionalLight(0x90b0d0, 0.5);
    secondaryFill.position.set(-20, 20, -20);
    scene.add(secondaryFill);

    // Pulsing point light for fire alarms
    const alarmLight = new THREE.PointLight(0xc92a2a, 0, 15);
    alarmLight.position.set(-3, 6, -1);
    scene.add(alarmLight);
    alarmLightRef.current = alarmLight;

    // 5. Architectural Ground Coordinate Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x3e4249, 0x23262b);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // Ground foundation slab
    const groundGeo = new THREE.BoxGeometry(32, 0.3, 24);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1d1e22,
      roughness: 0.9,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -0.2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 6. Build Procedural 3-Floor Architectural Geometry
    const floorGroups = new Map<number, THREE.Group>();
    const zoneMeshes = new Map<string, THREE.Mesh>();

    const floorHeights = [0, 4.2, 8.4]; // Elevation for floors 1, 2, 3
    [1, 2, 3].forEach((floorNum, idx) => {
      const floorGroup = new THREE.Group();
      floorGroup.position.y = floorHeights[idx];
      floorGroup.name = `Floor-${floorNum}`;
      scene.add(floorGroup);
      floorGroups.set(floorNum, floorGroup);

      // Floor Concrete Slab
      const slabGeo = new THREE.BoxGeometry(22, 0.25, 16);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x282a2e,
        roughness: 0.8,
        metalness: 0.2,
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, 0, 0);
      slabMesh.receiveShadow = true;
      floorGroup.add(slabMesh);

      // Glass Exterior Outline Contour
      const contourGeo = new THREE.BoxGeometry(22.2, 3.8, 16.2);
      const edges = new THREE.EdgesGeometry(contourGeo);
      const contourLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x484c55, transparent: true, opacity: 0.5 })
      );
      contourLine.position.y = 1.9;
      floorGroup.add(contourLine);
    });

    floorGroupsRef.current = floorGroups;

    // 7. Add Rooms / Zones Partitions
    PROCEDURAL_ZONES.forEach((zone) => {
      const group = floorGroups.get(zone.floor);
      if (!group) return;

      const { x, z, width, depth } = zone.bounds;

      // Room Floor Area Tile
      const roomFloorGeo = new THREE.BoxGeometry(width - 0.2, 0.08, depth - 0.2);
      const roomFloorMat = new THREE.MeshStandardMaterial({
        color: zone.color,
        roughness: 0.6,
        metalness: 0.1,
      });
      const roomFloor = new THREE.Mesh(roomFloorGeo, roomFloorMat);
      roomFloor.position.set(x + width / 2, 0.15, z + depth / 2);
      roomFloor.receiveShadow = true;
      roomFloor.userData = { zone };
      group.add(roomFloor);
      zoneMeshes.set(zone.id, roomFloor);

      // Wall Partitions (Height 2.8m, perimeter with door cutout)
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xd8d6cf,
        roughness: 0.9,
        transparent: true,
        opacity: 0.85,
      });

      // Simple wall bounding perimeter
      const wallThickness = 0.15;
      const wallHeight = 2.4;

      // Back Wall
      const wallBackGeo = new THREE.BoxGeometry(width, wallHeight, wallThickness);
      const wallBack = new THREE.Mesh(wallBackGeo, wallMat);
      wallBack.position.set(x + width / 2, wallHeight / 2 + 0.1, z);
      wallBack.castShadow = true;
      group.add(wallBack);

      // Left Wall
      const wallLeftGeo = new THREE.BoxGeometry(wallThickness, wallHeight, depth);
      const wallLeft = new THREE.Mesh(wallLeftGeo, wallMat);
      wallLeft.position.set(x, wallHeight / 2 + 0.1, z + depth / 2);
      wallLeft.castShadow = true;
      group.add(wallLeft);

      // Wireframe outline for technical architectural look
      const roomEdges = new THREE.EdgesGeometry(roomFloorGeo);
      const roomOutline = new THREE.LineSegments(
        roomEdges,
        new THREE.LineBasicMaterial({ color: 0x8c8a84 })
      );
      roomOutline.position.copy(roomFloor.position);
      group.add(roomOutline);
    });

    zoneMeshesRef.current = zoneMeshes;

    // 8. Animation & Render Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Pulsing effect for alarm zones & beacon light
      if (alarmLightRef.current) {
        if (activeAlarms.length > 0) {
          const pulse = (Math.sin(elapsed * 6) + 1) * 0.5;
          alarmLightRef.current.intensity = 2.5 + pulse * 4.0;
        } else {
          alarmLightRef.current.intensity = 0;
        }
      }

      // Animate sensor beacon rings
      sensorMarkersRef.current.forEach(({ mesh, sensor }) => {
        if (sensor.status === "ALARM") {
          const ring = mesh.getObjectByName("pulseRing");
          if (ring) {
            const scale = 1 + ((elapsed * 2) % 1) * 1.5;
            ring.scale.set(scale, scale, scale);
            const mat = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat) mat.opacity = Math.max(0, 1 - (elapsed * 2) % 1);
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Handling
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [updateCameraPosition, activeAlarms.length]);

  /* ==========================================================================
   * POPULATE SENSOR 3D BEACONS IN SCENE
   * ========================================================================== */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing sensor markers
    sensorMarkersRef.current.forEach(({ mesh }) => {
      mesh.parent?.remove(mesh);
    });
    sensorMarkersRef.current = [];

    // Combine real sensors with demo sensors to ensure sensors on all 3 floors
    const allSensors: SensorDTO[] = [...sensors];

    // Floor 3 demo sensors if not already present
    if (!allSensors.some((s) => s.pos_z > 7.0)) {
      allSensors.push({
        id: 301,
        code: "SN-301-OPT",
        name: "Оптический извещатель Опенспейс-3",
        sensor_type: "SMOKE",
        status: "NORMAL",
        pos_x: -2.0,
        pos_y: 9.5,
        pos_z: -1.0,
        battery_level: 98.0,
        signal_strength: 94.0,
        latest_reading: { metric_type: "SMOKE_OBSCURATION", value: 0.02, unit: "%/m" },
      });
      allSensors.push({
        id: 302,
        code: "SN-302-HVAC",
        name: "Комбинированный датчик Венткамера",
        sensor_type: "COMBINED",
        status: "NORMAL",
        pos_x: 4.5,
        pos_y: 9.5,
        pos_z: -1.0,
        battery_level: 96.0,
        signal_strength: 91.0,
        latest_reading: { metric_type: "CO_PPM", value: 2.0, unit: "ppm" },
      });
    }

    // Add simulated alarm sensor if toggled
    if (simulatedAlarm) {
      allSensors.push({
        id: 999,
        code: "SN-201-SIM",
        name: "Датчик температуры Серверная (СИМУЛЯЦИЯ ТРЕВОГИ)",
        sensor_type: "HEAT",
        status: "ALARM",
        pos_x: -3.0,
        pos_y: 5.5,
        pos_z: -1.0,
        battery_level: 95.0,
        signal_strength: 92.0,
        latest_reading: { metric_type: "TEMPERATURE", value: 78.5, unit: "°C" },
      });
    }

    allSensors.forEach((sensor) => {
      // Determine which floor group this sensor belongs to
      let floorNum = 1;
      if (sensor.pos_y > 7.5 || sensor.pos_z > 6.0) floorNum = 3;
      else if (sensor.pos_y > 3.5 || sensor.pos_z > 2.5) floorNum = 2;

      const floorGroup = floorGroupsRef.current.get(floorNum);
      if (!floorGroup) return;

      const markerGroup = new THREE.Group();
      markerGroup.name = `SensorMarker-${sensor.code}`;

      // Color coding per sensor operational state
      let color = 0x1f8844; // NORMAL
      if (sensor.status === "WARNING") color = 0xd9822b;
      if (sensor.status === "ALARM") color = 0xc92a2a;
      if (sensor.status === "OFFLINE" || sensor.status === "FAULT") color = 0x687076;

      // 1. Vertical indicator stem
      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0x8e8c84, transparent: true, opacity: 0.6 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.6;
      markerGroup.add(stem);

      // 2. Spherical beacon core
      const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: sensor.status === "ALARM" ? 0.9 : 0.4,
        roughness: 0.3,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = 1.2;
      core.userData = { sensor };
      markerGroup.add(core);

      // 3. Pulsing alarm ring for ALARM status
      if (sensor.status === "ALARM") {
        const ringGeo = new THREE.RingGeometry(0.35, 0.55, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xc92a2a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.name = "pulseRing";
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 1.2;
        markerGroup.add(ring);
      }

      // Coordinate placement in room space
      markerGroup.position.set(sensor.pos_x, 0.2, sensor.pos_z);
      floorGroup.add(markerGroup);

      sensorMarkersRef.current.push({ mesh: markerGroup, sensor });
    });
  }, [sensors, simulatedAlarm]);

  /* ==========================================================================
   * FLOOR ISOLATION & EXPLODED VIEW CONTROLLER
   * ========================================================================== */
  useEffect(() => {
    const floorGroups = floorGroupsRef.current;

    floorGroups.forEach((group, floorNum) => {
      // Visibility filtering
      if (selectedFloor === "ALL") {
        group.visible = true;
        // Exploded view vertical spacing
        if (explodedView) {
          group.position.y = (floorNum - 1) * 7.5;
        } else {
          group.position.y = (floorNum - 1) * 4.2;
        }
      } else {
        if (floorNum === selectedFloor) {
          group.visible = true;
          group.position.y = 0; // Bring selected floor down to eye level
        } else {
          group.visible = false;
        }
      }
    });

    // Update alarm zone highlight
    const serverZoneMesh = zoneMeshesRef.current.get("f2-server");
    if (serverZoneMesh) {
      const mat = serverZoneMesh.material as THREE.MeshStandardMaterial;
      if (activeAlarms.length > 0) {
        mat.color.setHex(0x5a1818);
        mat.emissive.setHex(0xc92a2a);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.color.setHex(0xd0cfc9);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  }, [selectedFloor, explodedView, activeAlarms.length]);

  /* ==========================================================================
   * MOUSE ORBIT & RAYCASTING INTERACTION
   * ========================================================================== */
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    cameraAngleRef.current.theta -= deltaX * 0.008;
    cameraAngleRef.current.phi += deltaY * 0.008;
    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraAngleRef.current.radius = Math.max(
      12,
      Math.min(75, cameraAngleRef.current.radius + e.deltaY * 0.03)
    );
    updateCameraPosition();
  };

  const handleClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        // 1. Check for sensor hit
        if (hit.object.userData?.sensor) {
          setSelectedSensor(hit.object.userData.sensor);
          return;
        }
        // 2. Check for zone floor hit
        if (hit.object.userData?.zone) {
          setSelectedZone(hit.object.userData.zone);
          return;
        }
      }
    }
  };

  /* ==========================================================================
   * PRESET CAMERA CONTROLS
   * ========================================================================== */
  const resetCamera = () => {
    cameraAngleRef.current = { theta: Math.PI / 4, phi: Math.PI / 6, radius: 36 };
    updateCameraPosition();
  };

  const setTopView = () => {
    cameraAngleRef.current = { theta: 0, phi: Math.PI / 2 - 0.05, radius: 32 };
    updateCameraPosition();
  };

  const setFrontView = () => {
    cameraAngleRef.current = { theta: 0, phi: 0.15, radius: 34 };
    updateCameraPosition();
  };

  const zoomIn = () => {
    cameraAngleRef.current.radius = Math.max(12, cameraAngleRef.current.radius - 5);
    updateCameraPosition();
  };

  const zoomOut = () => {
    cameraAngleRef.current.radius = Math.min(75, cameraAngleRef.current.radius + 5);
    updateCameraPosition();
  };

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * TOP TELEMETRY STATUS BAR
       * ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCDAD4] pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#D9531E] uppercase tracking-widest">
            <span>MOD // 02 — 3D DIGITAL TWIN</span>
            <span className="text-[#DCDAD4]">—</span>
            <span className="text-[#5C5B56]">ПРОСТРАНСТВЕННАЯ МОДЕЛЬ ЗДАНИЯ</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#181816]">
            Интерактивный цифровой двойник
          </h1>
          <p className="text-xs text-[#5C5B56] mt-0.5">
            {building?.name ?? "Инженерно-лабораторный корпус Alpha"} • 3 этажа • Полный координатный контроль контуров
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant={simulatedAlarm ? "danger" : "secondary"}
            size="sm"
            codePrefix="SIM"
            onClick={() => setSimulatedAlarm(!simulatedAlarm)}
          >
            <Flame className="w-3.5 h-3.5" />
            {simulatedAlarm ? "Сбросить тревогу" : "Тест тревоги (Этаж 2)"}
          </Button>

          {onRefresh && (
            <Button variant="secondary" size="sm" codePrefix="SYNC" onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5" />
              Опросить узлы
            </Button>
          )}
        </div>
      </div>

      {/* ====================================================================
       * MAIN 3D VIEWPORT CONTAINER & INSPECTION DRAWER
       * ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Interactive 3D Canvas */}
        <div className="lg:col-span-8 space-y-3">
          <div
            className={`border border-[#DCDAD4] bg-[#17181A] relative select-none overflow-hidden transition-all duration-200 ${
              isFullscreen ? "fixed inset-0 z-50 rounded-none" : "min-h-[580px] h-[580px]"
            }`}
          >
            {/* Viewport Top Bar Overlay */}
            <div className="absolute top-0 inset-x-0 z-10 p-3 sm:p-4 bg-gradient-to-b from-[#17181A]/90 to-transparent flex flex-wrap items-center justify-between gap-3 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <StatusSignal
                  status={activeAlarms.length > 0 ? "ALARM" : "NORMAL"}
                  label={
                    activeAlarms.length > 0
                      ? `ТРЕВОГА // СРАБАТЫВАНИЕ В ЗОНЕ Z-201`
                      : "КОНТУР 3D СИНХРОНИЗИРОВАН"
                  }
                  pulse={activeAlarms.length > 0}
                />
                <span className="font-mono text-[10px] text-[#96948E] hidden md:inline">
                  МЕТРИКА: METRIC [X, Y, Z]
                </span>
              </div>

              {/* Floor Selector Buttons */}
              <div className="flex items-center gap-1 font-mono text-xs pointer-events-auto bg-[#17181A]/80 border border-white/15 p-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedFloor("ALL")}
                  className={`px-2.5 py-1 text-[11px] transition-colors ${
                    selectedFloor === "ALL"
                      ? "bg-[#D9531E] text-white font-semibold"
                      : "text-[#96948E] hover:text-white"
                  }`}
                >
                  ВСЕ ЭТАЖИ
                </button>
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedFloor(num)}
                    className={`px-2.5 py-1 text-[11px] transition-colors ${
                      selectedFloor === num
                        ? "bg-[#D9531E] text-white font-semibold"
                        : "text-[#96948E] hover:text-white"
                    }`}
                  >
                    ЭТ. {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D WebGL Canvas */}
            <div
              ref={containerRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onClick={handleClick}
            />

            {/* Viewport Control Overlay (Bottom Left) */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 font-mono text-xs bg-[#17181A]/85 border border-white/15 p-1.5 text-white">
              <button
                type="button"
                onClick={resetCamera}
                title="Изометрический вид по умолчанию"
                className="px-2 py-1 bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3 text-[#D9531E]" /> ИЗОМЕТРИЯ
              </button>
              <button
                type="button"
                onClick={setTopView}
                title="Вид сверху (План этажей)"
                className="px-2 py-1 bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1 text-[11px]"
              >
                <Compass className="w-3 h-3 text-[#5C5B56]" /> ПЛАН
              </button>
              <button
                type="button"
                onClick={setFrontView}
                title="Вид спереди (Фасад)"
                className="px-2 py-1 bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1 text-[11px]"
              >
                <Eye className="w-3 h-3 text-[#5C5B56]" /> ФАСАД
              </button>
              <div className="h-4 w-[1px] bg-white/20 mx-1" />
              <button
                type="button"
                onClick={zoomIn}
                title="Приблизить"
                className="p-1 hover:bg-white/20 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={zoomOut}
                title="Отдалить"
                className="p-1 hover:bg-white/20 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-[1px] bg-white/20 mx-1" />
              <button
                type="button"
                onClick={() => setExplodedView(!explodedView)}
                title="Развернуть этажи (Exploded View)"
                className={`px-2 py-1 text-[11px] transition-colors ${
                  explodedView ? "bg-[#D9531E] text-white" : "bg-white/10 text-[#96948E]"
                }`}
              >
                ПОЭТАЖНЫЙ РАЗРЕЗ
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title="Полноэкранный режим сцены"
                className="p-1 hover:bg-white/20 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Interaction Instructions Overlay (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-3 font-mono text-[10px] text-[#96948E] bg-[#17181A]/80 border border-white/10 px-3 py-1.5">
              <span>ЛКМ: ВРАЩЕНИЕ</span>
              <span>•</span>
              <span>КОЛЕСО: МАСШТАБ</span>
              <span>•</span>
              <span>КЛИК: ВЫБОР ЗОНЫ/ДАТЧИКА</span>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Zone & Sensor Technical Inspector */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Active Inspection Card */}
          <div className="border border-[#DCDAD4] bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#D9531E]" />
                <span className="font-mono text-xs font-semibold uppercase text-[#181816]">
                  ИНСПЕКТОР КОНТУРА 3D
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#8E8C84]">SELECT // CLICK</span>
            </div>

            {/* If Sensor Selected */}
            {selectedSensor ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#F5F4F0] border border-[#DCDAD4] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#181816]">{selectedSensor.code}</span>
                    <StatusSignal status={selectedSensor.status} />
                  </div>
                  <div className="font-sans text-xs text-[#181816] font-medium">
                    {selectedSensor.name}
                  </div>
                  <div className="text-[11px] text-[#5C5B56] space-y-1 pt-1 border-t border-[#DCDAD4]">
                    <div>ТИП ОБОРУДОВАНИЯ: {selectedSensor.sensor_type}</div>
                    <div>
                      КООРДИНАТЫ: [{selectedSensor.pos_x.toFixed(1)},{" "}
                      {selectedSensor.pos_y.toFixed(1)}, {selectedSensor.pos_z.toFixed(1)}]
                    </div>
                    <div>
                      ПОСЛЕДНЕЕ ПОКАЗАНИЕ:{" "}
                      <strong className="text-[#181816]">
                        {selectedSensor.latest_reading
                          ? `${selectedSensor.latest_reading.value} ${selectedSensor.latest_reading.unit}`
                          : "НЕТ ДАННЫХ"}
                      </strong>
                    </div>
                    <div>БАТАРЕЯ: {selectedSensor.battery_level}%</div>
                    <div>СИГНАЛ: {selectedSensor.signal_strength}%</div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setSelectedSensor(null)}
                >
                  Снять выделение датчика
                </Button>
              </div>
            ) : selectedZone ? (
              /* If Zone Selected */
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#F5F4F0] border border-[#DCDAD4] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#181816]">{selectedZone.code}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] border ${
                        selectedZone.riskLevel === "CRITICAL"
                          ? "bg-[#FDECEC] border-[#C92A2A] text-[#A61B1B]"
                          : selectedZone.riskLevel === "HIGH"
                          ? "bg-[#FDF3E7] border-[#D9822B] text-[#9C540D]"
                          : "bg-[#E9F5EE] border-[#1F8844] text-[#146330]"
                      }`}
                    >
                      РИСК: {selectedZone.riskLevel}
                    </span>
                  </div>
                  <div className="font-sans text-xs text-[#181816] font-medium">
                    {selectedZone.name}
                  </div>
                  <div className="text-[11px] text-[#5C5B56] space-y-1 pt-1 border-t border-[#DCDAD4]">
                    <div>ЭТАЖ: {selectedZone.floor}</div>
                    <div>НАЗНАЧЕНИЕ: {selectedZone.type}</div>
                    <div>
                      ГАБАРИТЫ: {selectedZone.bounds.width}м × {selectedZone.bounds.depth}м (
                      {selectedZone.bounds.width * selectedZone.bounds.depth} м²)
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setSelectedZone(null)}
                >
                  Сбросить выбор зоны
                </Button>
              </div>
            ) : (
              /* Default Empty Selection Helper */
              <div className="p-4 border border-[#DCDAD4] bg-[#F5F4F0] text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-[#8E8C84] mx-auto" />
                <div className="font-mono text-xs font-semibold text-[#181816]">
                  ОБЪЕКТ НЕ ВЫБРАН
                </div>
                <p className="text-[11px] text-[#5C5B56] leading-relaxed">
                  Нажмите на любое помещение, коридор или маячок датчика на 3D-модели для
                  просмотра инженерных параметров.
                </p>
              </div>
            )}
          </div>

          {/* Alarm Telemetry Callout */}
          {activeAlarms.length > 0 && (
            <div className="border-l-4 border-l-[#C92A2A] border border-[#DCDAD4] bg-[#FDECEC]/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#C92A2A]">
                <AlertTriangle className="w-4 h-4" />
                АКТИВНЫЙ ОЧАГ ВОЗГОРАНИЯ
              </div>
              <p className="text-xs text-[#181816]">
                Локализовано превышение контрольного порога в зоне{" "}
                <strong>Z-201 (Центральная серверная, Этаж 2)</strong>.
              </p>
              <div className="font-mono text-[11px] text-[#5C5B56] space-y-0.5">
                <div>ТЕМПЕРАТУРА: 78.5 °C (ПОРОГ 58.0 °C)</div>
                <div>СТАТУС ЗОНЫ: ТРЕВОГА 1 РЕЙТИНГА</div>
              </div>
            </div>
          )}

          {/* Legend of 3D Markers */}
          <div className="border border-[#DCDAD4] bg-white p-4 space-y-3 font-mono text-xs">
            <div className="text-[10px] text-[#8E8C84] uppercase tracking-wider font-semibold border-b border-[#DCDAD4] pb-2">
              ОБОЗНАЧЕНИЯ НА 3D-СЦЕНЕ
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1F8844]" />
                  <span>Штатный режим (NORMAL)</span>
                </span>
                <span className="text-[#8E8C84]">Шлейф ОК</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9822B]" />
                  <span>Предупреждение (WARNING)</span>
                </span>
                <span className="text-[#8E8C84]">Порог 80%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C92A2A] animate-ping" />
                  <span>Пожарная тревога (ALARM)</span>
                </span>
                <span className="text-[#C92A2A] font-bold">Сработка</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#687076]" />
                  <span>Нет связи (OFFLINE / FAULT)</span>
                </span>
                <span className="text-[#8E8C84]">Обрыв</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
