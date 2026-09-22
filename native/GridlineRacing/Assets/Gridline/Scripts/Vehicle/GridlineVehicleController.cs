using UnityEngine;

namespace Gridline.Native
{
    [RequireComponent(typeof(Rigidbody))]
    public sealed class GridlineVehicleController : MonoBehaviour
    {
        [Header("Generated wheel references")]
        public Transform[] FrontWheelSteerPivots;
        public Transform[] WheelSpinNodes;

        [Header("Powertrain")]
        [SerializeField] private float maxSpeedKph = 285f;
        [SerializeField] private float motorAcceleration = 19f;
        [SerializeField] private float reverseAcceleration = 8f;
        [SerializeField] private float brakeAcceleration = 32f;

        [Header("Handling")]
        [SerializeField] private float steerAcceleration = 82f;
        [SerializeField] private float maxSteerAngle = 32f;
        [SerializeField] private float lowSpeedGrip = 10.5f;
        [SerializeField] private float highSpeedGrip = 4.4f;
        [SerializeField] private float handbrakeGrip = 1.15f;
        [SerializeField] private float downforce = 0.045f;

        [Header("Reset")]
        [SerializeField] private Vector3 spawnPosition = new Vector3(0f, 0.62f, -26f);
        [SerializeField] private Vector3 spawnEuler = Vector3.zero;

        private static readonly float[] GearTopSpeeds = { 0f, 58f, 96f, 142f, 188f, 234f, 285f, 330f };

        private Rigidbody body;
        private float throttleInput;
        private float brakeInput;
        private float steerInput;
        private float handbrakeInput;
        private float smoothedSteer;
        private float speedKph;
        private float rpm;
        private int gear = 1;
        private float lateralG;
        private float longitudinalG;
        private Vector3 previousLocalVelocity;

        public float ThrottleInput => throttleInput;
        public float BrakeInput => brakeInput;
        public float SteerInput => steerInput;
        public float SpeedKph => speedKph;
        public float Rpm => rpm;
        public int Gear => gear;
        public float LateralG => lateralG;
        public float LongitudinalG => longitudinalG;

        private void Awake()
        {
            body = GetComponent<Rigidbody>();
            body.centerOfMass = new Vector3(0f, -0.42f, -0.1f);
        }

        private void Update()
        {
            ReadInput();
            UpdatePowertrainDisplay();
            AnimateWheels();
        }

        private void FixedUpdate()
        {
            Vector3 localVelocity = transform.InverseTransformDirection(body.linearVelocity);
            speedKph = body.linearVelocity.magnitude * 3.6f;
            UpdateGForces(localVelocity);

            if (!GridlineGameState.IsDriving)
            {
                ApplyMenuDamping();
                previousLocalVelocity = localVelocity;
                return;
            }

            ApplyDriving(localVelocity);
            previousLocalVelocity = localVelocity;

            if (transform.position.y < -5f)
            {
                ResetCar();
            }
        }

        public void ResetCar()
        {
            if (body == null)
            {
                body = GetComponent<Rigidbody>();
            }

            transform.SetPositionAndRotation(spawnPosition, Quaternion.Euler(spawnEuler));
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            previousLocalVelocity = Vector3.zero;
        }

        private void ReadInput()
        {
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                if (GridlineGameState.IsMenu)
                {
                    GridlineGameState.StartDriving();
                }
            }

            if (Input.GetKeyDown(KeyCode.Escape))
            {
                GridlineGameState.ReturnToMenu();
            }

            if (Input.GetKeyDown(KeyCode.P))
            {
                GridlineGameState.TogglePause();
            }

            if (Input.GetKeyDown(KeyCode.R))
            {
                ResetCar();
            }

            if (!GridlineGameState.IsDriving)
            {
                throttleInput = 0f;
                brakeInput = 0f;
                steerInput = 0f;
                handbrakeInput = 0f;
                return;
            }

            GridlineInputRouter input = GridlineInputRouter.Instance;
            if (input == null)
            {
                throttleInput = 0f;
                brakeInput = 0f;
                steerInput = 0f;
                handbrakeInput = 0f;
                return;
            }

            throttleInput = Mathf.MoveTowards(throttleInput, input.Throttle, Time.unscaledDeltaTime * 5f);
            brakeInput = Mathf.MoveTowards(brakeInput, input.Brake, Time.unscaledDeltaTime * 7f);
            steerInput = Mathf.MoveTowards(steerInput, input.Steering, Time.unscaledDeltaTime * 6f);
            handbrakeInput = input.Handbrake;
        }

        private void ApplyDriving(Vector3 localVelocity)
        {
            float forwardSpeed = localVelocity.z;
            float speedRatio = Mathf.Clamp01(speedKph / maxSpeedKph);
            float availableMotor = motorAcceleration * Mathf.Clamp01(1f - speedRatio * 0.82f);

            if (throttleInput > 0.01f && speedKph < maxSpeedKph)
            {
                body.AddForce(transform.forward * (throttleInput * availableMotor), ForceMode.Acceleration);
            }

            if (brakeInput > 0.01f)
            {
                if (forwardSpeed > 1.2f)
                {
                    body.AddForce(-transform.forward * (brakeInput * brakeAcceleration), ForceMode.Acceleration);
                }
                else
                {
                    body.AddForce(-transform.forward * (brakeInput * reverseAcceleration), ForceMode.Acceleration);
                }
            }

            float speedSteerFactor = Mathf.Clamp01(Mathf.Abs(forwardSpeed) / 9f);
            float highSpeedSteerLimit = Mathf.Lerp(1f, 0.46f, Mathf.Clamp01(speedKph / 230f));
            smoothedSteer = Mathf.MoveTowards(smoothedSteer, steerInput, Time.fixedDeltaTime * 5.8f);
            float yaw = smoothedSteer * steerAcceleration * speedSteerFactor * highSpeedSteerLimit;
            body.AddTorque(Vector3.up * yaw, ForceMode.Acceleration);

            float grip = Mathf.Lerp(lowSpeedGrip, highSpeedGrip, Mathf.Clamp01(speedKph / 190f));
            float aggressiveInput = Mathf.Clamp01((Mathf.Abs(smoothedSteer) * speedKph - 64f) / 105f);
            float brakeRotationRisk = brakeInput * Mathf.Clamp01(speedKph / 150f) * 0.45f;
            float slideRisk = Mathf.Clamp01(aggressiveInput + brakeRotationRisk + handbrakeInput * 0.72f);
            grip = Mathf.Lerp(grip, handbrakeGrip, slideRisk);

            Vector3 lateralVelocity = transform.right * localVelocity.x;
            body.AddForce(-lateralVelocity * grip, ForceMode.Acceleration);
            body.AddForce(-transform.up * (body.linearVelocity.sqrMagnitude * downforce), ForceMode.Acceleration);
        }

        private void ApplyMenuDamping()
        {
            body.linearVelocity = Vector3.Lerp(body.linearVelocity, Vector3.zero, Time.fixedDeltaTime * 2.25f);
            body.angularVelocity = Vector3.Lerp(body.angularVelocity, Vector3.zero, Time.fixedDeltaTime * 3.4f);
        }

        private void UpdateGForces(Vector3 localVelocity)
        {
            Vector3 delta = (localVelocity - previousLocalVelocity) / Mathf.Max(Time.fixedDeltaTime, 0.0001f);
            lateralG = Mathf.Lerp(lateralG, delta.x / 9.81f, 0.18f);
            longitudinalG = Mathf.Lerp(longitudinalG, delta.z / 9.81f, 0.18f);
        }

        private void UpdatePowertrainDisplay()
        {
            gear = 1;
            for (int i = 1; i < GearTopSpeeds.Length - 1; i++)
            {
                if (speedKph > GearTopSpeeds[i] - 6f)
                {
                    gear = i + 1;
                }
            }

            float lower = GearTopSpeeds[Mathf.Clamp(gear - 1, 0, GearTopSpeeds.Length - 1)];
            float upper = GearTopSpeeds[Mathf.Clamp(gear, 1, GearTopSpeeds.Length - 1)];
            float gearProgress = Mathf.InverseLerp(lower, upper, speedKph);
            rpm = Mathf.Lerp(2900f, 11200f, gearProgress) + throttleInput * 700f;
        }

        private void AnimateWheels()
        {
            if (FrontWheelSteerPivots != null)
            {
                foreach (Transform pivot in FrontWheelSteerPivots)
                {
                    if (pivot == null)
                    {
                        continue;
                    }

                    pivot.localRotation = Quaternion.Euler(0f, smoothedSteer * maxSteerAngle, 0f);
                }
            }

            if (WheelSpinNodes == null)
            {
                return;
            }

            float wheelRadius = 0.46f;
            float spinDegrees = (body != null ? body.linearVelocity.magnitude : 0f) / Mathf.Max(wheelRadius, 0.01f) * Mathf.Rad2Deg * Time.deltaTime;
            float direction = Vector3.Dot(transform.forward, body != null ? body.linearVelocity : Vector3.zero) >= 0f ? 1f : -1f;

            foreach (Transform wheel in WheelSpinNodes)
            {
                if (wheel == null)
                {
                    continue;
                }

                wheel.Rotate(Vector3.right, spinDegrees * direction, Space.Self);
            }
        }
    }
}
