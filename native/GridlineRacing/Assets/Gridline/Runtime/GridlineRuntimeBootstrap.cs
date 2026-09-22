using UnityEngine;

namespace Gridline.Native.Runtime
{
    public static class GridlineRuntimeBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void CreatePrototype()
        {
            if (Object.FindFirstObjectByType<GridlineVehicleController>() != null) return;

            Application.targetFrameRate = 60;
            Time.fixedDeltaTime = 1f / 60f;

            var root = new GameObject("Gridline Prototype");
            CreateLighting();
            CreateTrack(root.transform);
            CreateCar(root.transform);
        }

        private static void CreateLighting()
        {
            var light = new GameObject("Sun").AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            light.transform.rotation = Quaternion.Euler(48f, -28f, 0f);
            RenderSettings.ambientIntensity = 0.8f;
        }

        private static void CreateTrack(Transform parent)
        {
            var track = GameObject.CreatePrimitive(PrimitiveType.Cube);
            track.name = "Test Track";
            track.transform.SetParent(parent);
            track.transform.position = new Vector3(0f, -0.15f, 0f);
            track.transform.localScale = new Vector3(34f, 0.3f, 180f);
            track.GetComponent<Renderer>().material.color = new Color(0.12f, 0.13f, 0.15f);

            CreateBarrier(parent, new Vector3(-18f, 0.5f, 0f));
            CreateBarrier(parent, new Vector3(18f, 0.5f, 0f));
            CreateBarrier(parent, new Vector3(0f, 0.5f, 90f), new Vector3(36f, 1f, 1f));
            CreateBarrier(parent, new Vector3(0f, 0.5f, -90f), new Vector3(36f, 1f, 1f));
        }

        private static void CreateBarrier(Transform parent, Vector3 position, Vector3 scale = default)
        {
            var barrier = GameObject.CreatePrimitive(PrimitiveType.Cube);
            barrier.name = "Track Barrier";
            barrier.transform.SetParent(parent);
            barrier.transform.position = position;
            barrier.transform.localScale = scale == default ? new Vector3(1f, 1f, 180f) : scale;
            barrier.GetComponent<Renderer>().material.color = new Color(0.65f, 0.08f, 0.05f);
        }

        private static void CreateCar(Transform parent)
        {
            var car = new GameObject("Player Car");
            car.transform.SetParent(parent);
            car.transform.position = new Vector3(0f, 0.8f, -65f);

            var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
            body.name = "Chassis";
            body.transform.SetParent(car.transform);
            body.transform.localScale = new Vector3(1.8f, 0.45f, 3.8f);
            body.GetComponent<Renderer>().material.color = new Color(0.85f, 0.05f, 0.03f);

            var rb = car.AddComponent<Rigidbody>();
            rb.mass = 1200f;
            rb.drag = 0.08f;
            rb.angularDrag = 3f;
            rb.centerOfMass = new Vector3(0f, -0.35f, 0f);
            car.AddComponent<GridlineVehicleController>();

            var camera = new GameObject("Chase Camera").AddComponent<GridlineChaseCamera>();
            camera.target = car.transform;
        }
    }

    public sealed class GridlineVehicleController : MonoBehaviour
    {
        public float SpeedKph { get; private set; }
        public float Throttle { get; private set; }
        public float Brake { get; private set; }
        public float Steering { get; private set; }
        public float LongitudinalG { get; private set; }
        public float LateralG { get; private set; }

        private Rigidbody body;
        private Vector3 previousVelocity;

        private void Awake() => body = GetComponent<Rigidbody>();

        private void FixedUpdate()
        {
            Throttle = Mathf.Clamp01(Input.GetAxis("Vertical"));
            Brake = Mathf.Clamp01(-Input.GetAxis("Vertical"));
            Steering = Input.GetAxis("Horizontal");

            var forward = transform.forward;
            var speed = Vector3.Dot(body.velocity, forward);
            body.AddForce(forward * (Throttle * 5200f), ForceMode.Force);
            if (Brake > 0f) body.AddForce(-body.velocity.normalized * (Brake * 9000f), ForceMode.Force);
            body.AddTorque(Vector3.up * (Steering * Mathf.Clamp(Mathf.Abs(speed), 0f, 30f) * 8f), ForceMode.Force);
            body.velocity = Vector3.ClampMagnitude(body.velocity, 48f);

            var acceleration = (body.velocity - previousVelocity) / Time.fixedDeltaTime;
            LongitudinalG = Vector3.Dot(acceleration, transform.forward) / 9.81f;
            LateralG = Vector3.Dot(acceleration, transform.right) / 9.81f;
            SpeedKph = body.velocity.magnitude * 3.6f;
            previousVelocity = body.velocity;
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.R))
            {
                body.position = new Vector3(0f, 0.8f, -65f);
                body.rotation = Quaternion.identity;
                body.velocity = Vector3.zero;
                body.angularVelocity = Vector3.zero;
            }
        }
    }

    public sealed class GridlineChaseCamera : MonoBehaviour
    {
        public Transform target;
        private void LateUpdate()
        {
            if (target == null) return;
            var desired = target.position - target.forward * 8f + Vector3.up * 4.5f;
            transform.position = Vector3.Lerp(transform.position, desired, 1f - Mathf.Exp(-8f * Time.deltaTime));
            transform.LookAt(target.position + Vector3.up * 0.5f);
        }
    }
}
