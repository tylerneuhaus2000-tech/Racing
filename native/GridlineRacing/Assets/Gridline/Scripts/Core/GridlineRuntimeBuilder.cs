using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    public static class GridlineRuntimeBuilder
    {
        private const string SceneRootName = "Gridline Prototype Scene";

        public static GridlineVehicleController Vehicle { get; private set; }
        public static GridlineTrackData Track { get; private set; }

        public static void BuildIfNeeded()
        {
            if (GameObject.Find(SceneRootName) != null)
            {
                return;
            }

            GameObject sceneRoot = new GameObject(SceneRootName);

            Material asphalt = CreateMaterial("Gridline Asphalt", new Color(0.055f, 0.061f, 0.068f));
            Material grass = CreateMaterial("Gridline Grass", new Color(0.08f, 0.24f, 0.11f));
            Material curbRed = CreateMaterial("Gridline Curb Red", new Color(0.8f, 0.04f, 0.04f));
            Material curbWhite = CreateMaterial("Gridline Curb White", new Color(0.92f, 0.9f, 0.84f));
            Material line = CreateMaterial("Gridline Track Line", new Color(0.95f, 0.88f, 0.18f));
            Material body = CreateMaterial("Gridline Prototype Red", new Color(0.86f, 0.05f, 0.08f));
            Material carbon = CreateMaterial("Gridline Carbon", new Color(0.018f, 0.02f, 0.025f));
            Material glass = CreateMaterial("Gridline Glass", new Color(0.09f, 0.16f, 0.22f));
            Material tire = CreateMaterial("Gridline Tire", new Color(0.006f, 0.006f, 0.007f));

            CreateLighting(sceneRoot.transform);
            Track = GridlineTrackData.Load("Tracks/silverstone-gp");
            CreateTrack(sceneRoot.transform, Track, grass, asphalt, curbRed, curbWhite, line);
            Vector3 spawnPosition = Track != null ? Track.Point(0) + Vector3.up * 0.65f : new Vector3(0f, 0.62f, -26f);
            Quaternion spawnRotation = Track != null ? Quaternion.LookRotation(Track.Forward(0), Vector3.up) : Quaternion.identity;
            Vehicle = CreateCar(sceneRoot.transform, body, carbon, glass, tire, spawnPosition, spawnRotation);
            GridlineLapSystem lapSystem = sceneRoot.AddComponent<GridlineLapSystem>();
            lapSystem.Configure(Vehicle, Track);
            CreateCamera(sceneRoot.transform, Vehicle.transform);
            CreateHud(sceneRoot.transform, Vehicle, lapSystem);
        }

        private static Material CreateMaterial(string name, Color color)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                shader = Shader.Find("Standard");
            }

            if (shader == null)
            {
                shader = Shader.Find("Diffuse");
            }

            Material material = new Material(shader)
            {
                name = name,
                color = color
            };
            return material;
        }

        private static void CreateLighting(Transform parent)
        {
            GameObject sun = new GameObject("Sun");
            sun.transform.SetParent(parent);
            sun.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
            Light light = sun.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.25f;
            light.color = new Color(1f, 0.95f, 0.86f);
        }

        private static void CreateTrack(
            Transform parent,
            GridlineTrackData track,
            Material grass,
            Material asphalt,
            Material curbRed,
            Material curbWhite,
            Material line)
        {
            if (track != null)
            {
                CreateSilverstoneTrack(parent, track, grass, asphalt, curbRed, curbWhite, line);
                return;
            }

            GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.SetParent(parent);
            ground.transform.position = Vector3.zero;
            ground.transform.localScale = new Vector3(22f, 1f, 16f);
            ground.GetComponent<Renderer>().sharedMaterial = grass;

            CreateCube("Main Straight", parent, new Vector3(0f, 0.025f, -26f), new Vector3(112f, 0.05f, 15f), asphalt, false);
            CreateCube("Back Straight", parent, new Vector3(0f, 0.025f, 26f), new Vector3(112f, 0.05f, 15f), asphalt, false);
            CreateCube("West Turn Pad", parent, new Vector3(-56f, 0.025f, 0f), new Vector3(15f, 0.05f, 67f), asphalt, false);
            CreateCube("East Turn Pad", parent, new Vector3(56f, 0.025f, 0f), new Vector3(15f, 0.05f, 67f), asphalt, false);
            CreateCube("Start Finish", parent, new Vector3(0f, 0.07f, -26f), new Vector3(0.45f, 0.05f, 15.2f), curbWhite, false);

            for (int i = -50; i <= 50; i += 10)
            {
                CreateCube("Center Line A", parent, new Vector3(i, 0.08f, -26f), new Vector3(4.5f, 0.05f, 0.25f), line, false);
                CreateCube("Center Line B", parent, new Vector3(i, 0.08f, 26f), new Vector3(4.5f, 0.05f, 0.25f), line, false);
            }

            for (int i = 0; i < 28; i++)
            {
                float x = -68f + i * 5f;
                Material material = i % 2 == 0 ? curbRed : curbWhite;
                CreateCube("South Outside Curb", parent, new Vector3(x, 0.09f, -34f), new Vector3(3.5f, 0.08f, 0.9f), material, false);
                CreateCube("North Outside Curb", parent, new Vector3(x, 0.09f, 34f), new Vector3(3.5f, 0.08f, 0.9f), material, false);
            }

            for (int i = 0; i < 14; i++)
            {
                float z = -32f + i * 5f;
                Material material = i % 2 == 0 ? curbRed : curbWhite;
                CreateCube("West Outside Curb", parent, new Vector3(-64f, 0.09f, z), new Vector3(0.9f, 0.08f, 3.5f), material, false);
                CreateCube("East Outside Curb", parent, new Vector3(64f, 0.09f, z), new Vector3(0.9f, 0.08f, 3.5f), material, false);
            }
        }

        private static void CreateSilverstoneTrack(
            Transform parent,
            GridlineTrackData track,
            Material grass,
            Material asphalt,
            Material curbRed,
            Material curbWhite,
            Material line)
        {
            GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Silverstone Terrain";
            ground.transform.SetParent(parent);
            ground.transform.position = new Vector3(0f, -0.2f, 0f);
            ground.transform.localScale = new Vector3(115f, 1f, 115f);
            ground.GetComponent<Renderer>().sharedMaterial = grass;

            List<Vector3> roadVertices = new List<Vector3>(track.points.Length * 4);
            List<int> roadTriangles = new List<int>(track.points.Length * 6);
            List<Vector3> boundaryVertices = new List<Vector3>(track.points.Length * 8);
            List<int> boundaryTriangles = new List<int>(track.points.Length * 12);

            for (int i = 0; i < track.points.Length; i += 1)
            {
                Vector3 current = track.Point(i);
                Vector3 next = track.Point(i + 1);
                Vector3 segment = next - current;
                float length = Vector3.ProjectOnPlane(segment, Vector3.up).magnitude;
                if (length < 0.1f)
                {
                    continue;
                }

                Vector3 forward = new Vector3(segment.x, 0f, segment.z).normalized;
                Vector3 right = new Vector3(forward.z, 0f, -forward.x);
                Vector3 currentLeft = current - right * track.halfWidth + Vector3.up * 0.02f;
                Vector3 currentRight = current + right * track.halfWidth + Vector3.up * 0.02f;
                Vector3 nextLeft = next - right * track.halfWidth + Vector3.up * 0.02f;
                Vector3 nextRight = next + right * track.halfWidth + Vector3.up * 0.02f;
                AddQuad(roadVertices, roadTriangles, currentLeft, currentRight, nextLeft, nextRight);

                Vector3 boundaryLeftA = current - right * (track.halfWidth + 0.45f) + Vector3.up * 0.11f;
                Vector3 boundaryLeftB = current - right * (track.halfWidth + 1.15f) + Vector3.up * 0.11f;
                Vector3 boundaryLeftC = next - right * (track.halfWidth + 0.45f) + Vector3.up * 0.11f;
                Vector3 boundaryLeftD = next - right * (track.halfWidth + 1.15f) + Vector3.up * 0.11f;
                Vector3 boundaryRightA = current + right * (track.halfWidth + 0.45f) + Vector3.up * 0.11f;
                Vector3 boundaryRightB = current + right * (track.halfWidth + 1.15f) + Vector3.up * 0.11f;
                Vector3 boundaryRightC = next + right * (track.halfWidth + 0.45f) + Vector3.up * 0.11f;
                Vector3 boundaryRightD = next + right * (track.halfWidth + 1.15f) + Vector3.up * 0.11f;
                AddQuad(boundaryVertices, boundaryTriangles, boundaryLeftA, boundaryLeftB, boundaryLeftC, boundaryLeftD);
                AddQuad(boundaryVertices, boundaryTriangles, boundaryRightB, boundaryRightA, boundaryRightD, boundaryRightC);
            }

            CreateMeshObject("Silverstone Road Mesh", parent, roadVertices, roadTriangles, asphalt, true);
            CreateMeshObject("Silverstone Boundary Mesh", parent, boundaryVertices, boundaryTriangles, curbRed, true);

            Vector3 start = track.Point(0) + Vector3.up * 0.16f;
            Quaternion startRotation = Quaternion.LookRotation(track.Forward(0), Vector3.up);
            CreateCube("Silverstone Start Finish", parent, start,
                new Vector3(track.halfWidth * 2f, 0.04f, 0.45f), line, false,
                startRotation * Quaternion.Euler(0f, 90f, 0f));
        }

        private static void AddQuad(List<Vector3> vertices, List<int> triangles, Vector3 a, Vector3 b, Vector3 c, Vector3 d)
        {
            int start = vertices.Count;
            vertices.Add(a);
            vertices.Add(b);
            vertices.Add(c);
            vertices.Add(d);
            triangles.Add(start);
            triangles.Add(start + 2);
            triangles.Add(start + 1);
            triangles.Add(start + 1);
            triangles.Add(start + 2);
            triangles.Add(start + 3);
        }

        private static GameObject CreateMeshObject(
            string name,
            Transform parent,
            List<Vector3> vertices,
            List<int> triangles,
            Material material,
            bool collision)
        {
            GameObject meshObject = new GameObject(name);
            meshObject.transform.SetParent(parent);
            Mesh mesh = new Mesh { name = name };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            meshObject.AddComponent<MeshFilter>().sharedMesh = mesh;
            meshObject.AddComponent<MeshRenderer>().sharedMaterial = material;
            if (collision)
            {
                meshObject.AddComponent<MeshCollider>().sharedMesh = mesh;
            }

            return meshObject;
        }

        private static GridlineVehicleController CreateCar(
            Transform parent,
            Material body,
            Material carbon,
            Material glass,
            Material tire,
            Vector3 spawnPosition,
            Quaternion spawnRotation)
        {
            GameObject car = new GameObject("Gridline Prototype GT");
            car.transform.SetParent(parent);
            car.transform.SetPositionAndRotation(spawnPosition, spawnRotation);

            Rigidbody rigidbody = car.AddComponent<Rigidbody>();
            rigidbody.mass = 1225f;
            rigidbody.linearDamping = 0.02f;
            rigidbody.angularDamping = 1.35f;
            rigidbody.interpolation = RigidbodyInterpolation.Interpolate;
            rigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            BoxCollider collider = car.AddComponent<BoxCollider>();
            collider.center = new Vector3(0f, 0.35f, 0f);
            collider.size = new Vector3(1.95f, 0.8f, 4.1f);

            CreateCube("Body", car.transform, new Vector3(0f, 0.36f, 0f), new Vector3(2.05f, 0.5f, 4.2f), body, true);
            CreateCube("Cabin", car.transform, new Vector3(0f, 0.78f, -0.35f), new Vector3(1.35f, 0.55f, 1.35f), glass, true);
            CreateCube("Front Splitter", car.transform, new Vector3(0f, 0.2f, 2.22f), new Vector3(2.25f, 0.12f, 0.28f), carbon, true);
            CreateCube("Rear Wing", car.transform, new Vector3(0f, 0.93f, -2.12f), new Vector3(2.35f, 0.12f, 0.36f), carbon, true);

            Transform frontLeftPivot = CreateWheel(car.transform, "Front Left Wheel", new Vector3(-1.08f, 0.22f, 1.38f), tire);
            Transform frontRightPivot = CreateWheel(car.transform, "Front Right Wheel", new Vector3(1.08f, 0.22f, 1.38f), tire);
            Transform rearLeftPivot = CreateWheel(car.transform, "Rear Left Wheel", new Vector3(-1.08f, 0.22f, -1.38f), tire);
            Transform rearRightPivot = CreateWheel(car.transform, "Rear Right Wheel", new Vector3(1.08f, 0.22f, -1.38f), tire);

            GridlineVehicleController controller = car.AddComponent<GridlineVehicleController>();
            controller.FrontWheelSteerPivots = new[] { frontLeftPivot, frontRightPivot };
            controller.WheelSpinNodes = new[]
            {
                frontLeftPivot.GetChild(0),
                frontRightPivot.GetChild(0),
                rearLeftPivot.GetChild(0),
                rearRightPivot.GetChild(0)
            };
            controller.ConfigureSpawnPose(spawnPosition, spawnRotation);
            controller.ResetCar();
            return controller;
        }

        private static Transform CreateWheel(Transform parent, string name, Vector3 localPosition, Material material)
        {
            GameObject pivot = new GameObject(name + " Pivot");
            pivot.transform.SetParent(parent);
            pivot.transform.localPosition = localPosition;
            pivot.transform.localRotation = Quaternion.identity;

            GameObject spinNode = new GameObject(name + " Spin");
            spinNode.transform.SetParent(pivot.transform);
            spinNode.transform.localPosition = Vector3.zero;
            spinNode.transform.localRotation = Quaternion.identity;

            GameObject wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            wheel.name = name;
            wheel.transform.SetParent(spinNode.transform);
            wheel.transform.localPosition = Vector3.zero;
            wheel.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            wheel.transform.localScale = new Vector3(0.46f, 0.2f, 0.46f);
            wheel.GetComponent<Renderer>().sharedMaterial = material;
            RemoveCollider(wheel);

            return pivot.transform;
        }

        private static void CreateCamera(Transform parent, Transform target)
        {
            GameObject cameraObject = new GameObject("Chase Camera");
            cameraObject.transform.SetParent(parent);
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 62f;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 700f;
            cameraObject.AddComponent<AudioListener>();

            GridlineCameraRig rig = cameraObject.AddComponent<GridlineCameraRig>();
            rig.Target = target;
        }

        private static void CreateHud(Transform parent, GridlineVehicleController vehicle, GridlineLapSystem lapSystem)
        {
            GameObject hudObject = new GameObject("Gridline Debug HUD");
            hudObject.transform.SetParent(parent);
            GridlineDebugHud hud = hudObject.AddComponent<GridlineDebugHud>();
            hud.Vehicle = vehicle;
            hud.LapSystem = lapSystem;
        }

        private static GameObject CreateCube(string name, Transform parent, Vector3 localPosition, Vector3 localScale, Material material, bool visualOnly, Quaternion? localRotation = null)
        {
            GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = name;
            cube.transform.SetParent(parent);
            cube.transform.localPosition = localPosition;
            cube.transform.localRotation = localRotation ?? Quaternion.identity;
            cube.transform.localScale = localScale;
            cube.GetComponent<Renderer>().sharedMaterial = material;

            if (visualOnly)
            {
                RemoveCollider(cube);
            }

            return cube;
        }

        private static void RemoveCollider(GameObject gameObject)
        {
            Collider collider = gameObject.GetComponent<Collider>();
            if (collider != null)
            {
                Object.Destroy(collider);
            }
        }
    }
}
