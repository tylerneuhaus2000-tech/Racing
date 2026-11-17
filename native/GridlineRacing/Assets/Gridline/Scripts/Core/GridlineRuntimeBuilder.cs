using GLTFast;
using UnityEngine;

namespace Gridline.Native
{
    // Builds one real driving slice: browser centerline + browser physics + the
    // original Monza GLB. There is deliberately no visible road fallback.
    public static class GridlineRuntimeBuilder
    {
        private const string SceneRootName = "Gridline Race World";
        private static readonly Vector3 MonzaMeshOffset = new Vector3(-226.06f, -199.83f, 348.01f);
        private static readonly Vector3 SilverstoneMeshOffset = new Vector3(-46.24f, 7.21f, 89.70f);

        public static GridlineVehicleController Vehicle { get; private set; }
        public static GridlineTrackData Track { get; private set; }
        public static GridlineLapSystem LapSystem { get; private set; }
        public static GridlineTimeTrialSession TimeTrial { get; private set; }
        public static GridlineRaceSession Race { get; private set; }

        public static void BuildIfNeeded()
        {
            if (GameObject.Find(SceneRootName) != null) return;

            GameObject world = new GameObject(SceneRootName);
            bool testFacility = HasArgument("-gridline-testpad");
            bool silverstoneTrack = HasArgument("-gridline-track=silverstone");
            Track = testFacility
                ? GridlineTrackData.CreateVehicleTestFacility()
                : GridlineTrackData.Load(silverstoneTrack
                    ? "Tracks/silverstone-gp"
                    : "Tracks/monza");
            if (Track == null) return;

            if (!testFacility)
            {
                Debug.Log($"Gridline {Track.name} configuration: officialDirection=clockwise "
                    + $"centerlineTraversal={(Track.reverseDirection ? "reversed" : "source-order")} "
                    + $"startFinishIndex=0 gridSourcePct={Track.startGridPct:0.0} "
                    + $"gridRuntimePct={(Track.reverseDirection ? 100f - Track.startGridPct : Track.startGridPct):0.0} "
                    + "checkpoints=ordered-0-to-11 sectors=1-4-8 wrongWay=direction-sensitive");
            }

            ConfigureWorldLighting(world.transform);
            if (testFacility) CreateVehicleTestFacilityVisual(world.transform, Track);
            else if (silverstoneTrack) CreateSilverstoneVisual(world.transform);
            else CreateMonzaVisual(world.transform);

            // Start close enough for the four physical suspension rays to reach
            // the real road immediately. The previous 1.25 m offset put the
            // ray ends above the GLB asphalt (the car fell through at S/F).
            // The QA driver still waits for contact before applying throttle.
            // Reversing the closed spline also mirrors the grid percentage.
            // Monza's browser data places the grid at 100% (the final
            // sample before the start/finish anchor); in reverse that same
            // physical start position is 0% of the reversed spline.
            float startGridPct = Track.reverseDirection
                ? 100f - Track.startGridPct
                : Track.startGridPct;
            int startIndex = startGridPct > 0f
                ? Mathf.Clamp(Mathf.RoundToInt((startGridPct / 100f) * (Track.points.Length - 1)), 0, Track.points.Length - 1)
                : 0;
            Vector3 spawn = Track.Point(startIndex) + Vector3.up * 0.45f;
            Quaternion rotation = Quaternion.LookRotation(Track.Forward(startIndex), Vector3.up);
            Vehicle = CreateVehicle(world.transform, spawn, rotation, "Player · Ferrari 296 GT3");

            LapSystem = world.AddComponent<GridlineLapSystem>();
            LapSystem.Configure(Vehicle, Track);
            Race = world.AddComponent<GridlineRaceSession>();
            Race.Configure(Vehicle, Track, LapSystem);
            TimeTrial = world.AddComponent<GridlineTimeTrialSession>();
            TimeTrial.Configure(Vehicle, LapSystem);

            if (Race.Enabled)
            {
                CreateRaceCars(world.transform, Race, startIndex, rotation);
            }

            GridlineQaDriver qaDriver = world.AddComponent<GridlineQaDriver>();
            qaDriver.Configure(Vehicle, Track, LapSystem);
            GridlineLapRulesQa rulesQa = world.AddComponent<GridlineLapRulesQa>();
            rulesQa.Configure(Vehicle, Track, LapSystem);
            GridlineVehicleDynamicsQa vehicleQa = world.AddComponent<GridlineVehicleDynamicsQa>();
            vehicleQa.Configure(Vehicle, Track);
            GridlineTyreForceQa tyreForceQa = world.AddComponent<GridlineTyreForceQa>();
            tyreForceQa.Configure(Vehicle, Track);
            GridlineGrassRegressionQa grassQa = world.AddComponent<GridlineGrassRegressionQa>();
            grassQa.Configure(Vehicle, Track);
            GridlineSurfaceInteractionQa surfaceQa = world.AddComponent<GridlineSurfaceInteractionQa>();
            surfaceQa.Configure();
            GridlineSpawnSurfaceQa spawnQa = world.AddComponent<GridlineSpawnSurfaceQa>();
            spawnQa.Configure(Track);

            CreateCamera(world.transform, Vehicle.transform);
            CreateHud(world.transform, Vehicle, LapSystem, TimeTrial, Race);
            world.AddComponent<GridlineTouchControls>();
        }

        private static bool HasArgument(string expected)
        {
            string[] args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
            {
                if (string.Equals(args[i], expected, System.StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static void ConfigureWorldLighting(Transform parent)
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.25f, 0.36f, 0.52f);
            RenderSettings.ambientEquatorColor = new Color(0.18f, 0.20f, 0.22f);
            RenderSettings.ambientGroundColor = new Color(0.06f, 0.09f, 0.05f);
            RenderSettings.ambientIntensity = 0.86f;
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.55f, 0.67f, 0.80f);
            RenderSettings.fogStartDistance = 260f;
            RenderSettings.fogEndDistance = 2100f;

            GameObject sunObject = new GameObject("Monza Sun");
            sunObject.transform.SetParent(parent);
            sunObject.transform.rotation = Quaternion.Euler(42f, -32f, 0f);
            Light sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.05f;
            sun.color = new Color(1f, 0.96f, 0.88f);
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.72f;
        }

        private static void CreateMonzaVisual(Transform parent)
        {
            GameObject holder = new GameObject("Monza · original GLB");
            holder.transform.SetParent(parent);
            holder.transform.localPosition = MonzaMeshOffset;
            holder.transform.localScale = Vector3.one;

            GltfAsset asset = holder.AddComponent<GltfAsset>();
            asset.StreamingAsset = true;
            asset.Url = "Content/Tracks/Monza_2020.glb";

            GridlineRuntimeModelMonitor monitor = holder.AddComponent<GridlineRuntimeModelMonitor>();
            monitor.Asset = asset;
            monitor.Kind = GridlineRuntimeModelMonitor.ModelKind.Track;
            monitor.AssetUrl = asset.Url;
            monitor.SourceLabel = "original Autodromo Nazionale Monza GLB";
            monitor.TextureFolder = "Monza";
        }

        private static void CreateSilverstoneVisual(Transform parent)
        {
            GameObject holder = new GameObject("Silverstone GP · Unity-compatible source GLB");
            holder.transform.SetParent(parent);
            holder.transform.localPosition = SilverstoneMeshOffset;
            holder.transform.localScale = Vector3.one;

            GltfAsset asset = holder.AddComponent<GltfAsset>();
            asset.StreamingAsset = true;
            asset.Url = "Content/Tracks/Silverstone_GP.glb";

            GridlineRuntimeModelMonitor monitor = holder.AddComponent<GridlineRuntimeModelMonitor>();
            monitor.Asset = asset;
            monitor.Kind = GridlineRuntimeModelMonitor.ModelKind.Track;
            monitor.AssetUrl = asset.Url;
            monitor.SourceLabel = "Unity-compatible Silverstone GP source derivative (geometry/textures identical)";
            monitor.TextureFolder = "Silverstone";
        }

        private static void CreateVehicleTestFacilityVisual(Transform parent, GridlineTrackData track)
        {
            Material asphalt = CreateFacilityMaterial("Test facility asphalt", new Color(0.11f, 0.13f, 0.15f));
            Material painted = CreateFacilityMaterial("Test facility markings", new Color(0.88f, 0.90f, 0.86f));
            Material yellow = CreateFacilityMaterial("Test facility yellow", new Color(0.92f, 0.64f, 0.06f));
            Material kerb = CreateFacilityMaterial("Test facility kerb", new Color(0.72f, 0.08f, 0.06f));
            Material cone = CreateFacilityMaterial("Test facility cones", new Color(1.0f, 0.27f, 0.04f));

            GameObject baseObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseObject.name = "Vehicle Dynamics Facility · 800m x 450m asphalt pad";
            baseObject.transform.SetParent(parent, false);
            baseObject.transform.position = new Vector3(0f, -0.30f, 0f);
            baseObject.transform.localScale = new Vector3(820f, 0.5f, 460f);
            baseObject.GetComponent<Renderer>().sharedMaterial = asphalt;
            GridlineTrackSurfaceTag surfaceTag = baseObject.AddComponent<GridlineTrackSurfaceTag>();
            surfaceTag.Surface = GridlineSurface.Track;

            for (int i = 0; i < track.points.Length; i += 1)
            {
                Vector3 a = track.Point(i) + Vector3.up * 0.012f;
                Vector3 b = track.Point(i + 1) + Vector3.up * 0.012f;
                Vector3 delta = b - a;
                delta.y = 0f;
                if (delta.sqrMagnitude < 0.01f) continue;
                GameObject mark = CreateFacilityCube(
                    $"Handling loop centerline {i:000}", (a + b) * 0.5f,
                    new Vector3(0.12f, 0.025f, delta.magnitude),
                    Quaternion.LookRotation(delta.normalized, Vector3.up), painted, parent);
                RemoveCollider(mark);
            }

            CreateFacilityLine(new Vector3(-330f, 0.03f, -188f), new Vector3(330f, 0.03f, -188f),
                painted, parent, 0.16f);
            CreateFacilityLine(new Vector3(-330f, 0.03f, 188f), new Vector3(330f, 0.03f, 188f),
                painted, parent, 0.16f);
            CreateFacilityLine(new Vector3(-330f, 0.03f, -15f), new Vector3(330f, 0.03f, -15f),
                yellow, parent, 0.10f);
            CreateFacilityLine(new Vector3(-330f, 0.03f, 15f), new Vector3(330f, 0.03f, 15f),
                yellow, parent, 0.10f);

            CreateFacilityRing(new Vector3(-125f, 0.04f, 55f), 68f, painted, parent);
            CreateFacilityRing(new Vector3(125f, 0.04f, 55f), 68f, painted, parent);
            CreateFacilityRing(new Vector3(-125f, 0.045f, 55f), 73f, kerb, parent);
            CreateFacilityRing(new Vector3(125f, 0.045f, 55f), 73f, kerb, parent);

            for (int i = 0; i < 12; i += 1)
            {
                float x = -240f + i * 40f;
                float z = i % 2 == 0 ? -45f : 45f;
                GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                obstacle.name = $"Slalom cone {i + 1}";
                obstacle.transform.SetParent(parent, false);
                obstacle.transform.position = new Vector3(x, 0.42f, z);
                obstacle.transform.localScale = new Vector3(0.75f, 0.42f, 0.75f);
                obstacle.GetComponent<Renderer>().sharedMaterial = cone;
                GridlineTrackSurfaceTag obstacleTag = obstacle.AddComponent<GridlineTrackSurfaceTag>();
                obstacleTag.Surface = GridlineSurface.Barrier;
            }

            Debug.Log("Gridline vehicle test facility built: 820m x 460m pad, loop, skidpads, slalom and measurement lanes");
        }

        private static Material CreateFacilityMaterial(string name, Color color)
        {
            Shader shader = Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineLitColor")
                ?? Resources.Load<Shader>("Graphics/Shaders/Built-In/GridlineFlatColor")
                ?? Shader.Find("Universal Render Pipeline/Lit")
                ?? Shader.Find("Standard")
                ?? Shader.Find("Unlit/Color");
            if (shader == null)
            {
                Debug.LogError($"Gridline test facility shader missing: {name}");
                return null;
            }
            Material material = new Material(shader) { name = name, color = color };
            if (material.HasProperty("_TextureMix")) material.SetFloat("_TextureMix", 0f);
            if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color")) material.SetColor("_Color", color);
            return material;
        }

        private static GameObject CreateFacilityCube(string name, Vector3 position, Vector3 scale,
            Quaternion rotation, Material material, Transform parent)
        {
            GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = name;
            cube.transform.SetParent(parent, false);
            cube.transform.SetPositionAndRotation(position, rotation);
            cube.transform.localScale = scale;
            cube.GetComponent<Renderer>().sharedMaterial = material;
            return cube;
        }

        private static void CreateFacilityLine(Vector3 start, Vector3 end, Material material,
            Transform parent, float width)
        {
            Vector3 delta = end - start;
            GameObject line = CreateFacilityCube("Test facility measurement line", (start + end) * 0.5f,
                new Vector3(width, 0.025f, delta.magnitude),
                Quaternion.LookRotation(delta.normalized, Vector3.up), material, parent);
            RemoveCollider(line);
        }

        private static void CreateFacilityRing(Vector3 center, float radius, Material material, Transform parent)
        {
            const int count = 48;
            for (int i = 0; i < count; i += 1)
            {
                float a = i * Mathf.PI * 2f / count;
                float b = (i + 1) * Mathf.PI * 2f / count;
                Vector3 start = center + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * radius;
                Vector3 end = center + new Vector3(Mathf.Cos(b), 0f, Mathf.Sin(b)) * radius;
                CreateFacilityLine(start, end, material, parent, 0.12f);
            }
        }

        private static void RemoveCollider(GameObject objectToClean)
        {
            Collider collider = objectToClean.GetComponent<Collider>();
            if (collider != null) Object.Destroy(collider);
        }

        private static GridlineVehicleController CreateVehicle(Transform parent, Vector3 spawn,
            Quaternion rotation, string vehicleName)
        {
            GameObject car = new GameObject(vehicleName);
            car.transform.SetParent(parent);
            car.transform.SetPositionAndRotation(spawn, rotation);

            GridlineVehicleController controller = car.AddComponent<GridlineVehicleController>();
            controller.Configure(Track, spawn, rotation);

            GameObject holder = new GameObject(vehicleName + " · original Ferrari GLB");
            holder.transform.SetParent(car.transform);
            holder.transform.localPosition = Vector3.zero;
            // The GLB's rendered nose already matches the Rigidbody's +Z
            // direction after glTFast's coordinate conversion. Rotating it
            // again made the car drive correctly while looking backwards.
            holder.transform.localRotation = Quaternion.identity;
            holder.transform.localScale = new Vector3(-100f, 100f, 100f);

            GltfAsset asset = holder.AddComponent<GltfAsset>();
            asset.StreamingAsset = true;
            asset.Url = "Content/Vehicles/Ferrari_296_GT3.glb";

            GridlineRuntimeModelMonitor monitor = holder.AddComponent<GridlineRuntimeModelMonitor>();
            monitor.Asset = asset;
            monitor.Vehicle = controller;
            monitor.Kind = GridlineRuntimeModelMonitor.ModelKind.Vehicle;
            return controller;
        }

        private static void CreateRaceCars(Transform parent, GridlineRaceSession race,
            int playerStartIndex, Quaternion playerRotation)
        {
            for (int i = 0; i < race.DesiredAiCount; i += 1)
            {
                int index = playerStartIndex + 14 + i * 12;
                Vector3 forward = Track.Forward(index);
                Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;
                float lateral = i % 2 == 0 ? -3.2f : 3.2f;
                Vector3 spawn = Track.Point(index) + side * lateral + Vector3.up * 0.45f;
                Quaternion rotation = Quaternion.LookRotation(forward, Vector3.up);
                GridlineVehicleController aiVehicle = CreateVehicle(parent, spawn, rotation,
                    $"AI {i + 1} · Ferrari 296 GT3");
                GridlineAiDriver ai = aiVehicle.gameObject.AddComponent<GridlineAiDriver>();
                ai.Configure(aiVehicle, Track, race, $"AI {i + 1}",
                    Mathf.Clamp(0.98f - i * 0.055f, 0.74f, 0.98f));
                race.RegisterAi(ai);
            }
        }

        private static void CreateCamera(Transform parent, Transform target)
        {
            GameObject cameraObject = new GameObject("Chase Camera");
            cameraObject.transform.SetParent(parent);
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 58f;
            camera.nearClipPlane = 0.05f;
            // The imported Silverstone GLB contains several million visible
            // vertices. Keep the actual track/collision untouched, but bound
            // the camera work to a useful driving distance for Apple Silicon
            // and iPad instead of asking Metal to shade the whole circuit.
            camera.farClipPlane = Application.isMobilePlatform ? 780f : 1200f;
            camera.allowHDR = false;
            camera.allowMSAA = false;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.55f, 0.67f, 0.80f);
            RenderSettings.fogEndDistance = camera.farClipPlane;
            cameraObject.AddComponent<AudioListener>();

            GridlineCameraRig rig = cameraObject.AddComponent<GridlineCameraRig>();
            rig.Target = target;
        }

        private static void CreateHud(Transform parent, GridlineVehicleController vehicle,
            GridlineLapSystem lapSystem, GridlineTimeTrialSession timeTrial, GridlineRaceSession race)
        {
            GameObject hudObject = new GameObject("Gridline Race HUD");
            hudObject.transform.SetParent(parent);
            GridlineDebugHud hud = hudObject.AddComponent<GridlineDebugHud>();
            hud.Vehicle = vehicle;
            hud.LapSystem = lapSystem;
            hud.TimeTrial = timeTrial;
            hud.Race = race;
        }
    }
}
