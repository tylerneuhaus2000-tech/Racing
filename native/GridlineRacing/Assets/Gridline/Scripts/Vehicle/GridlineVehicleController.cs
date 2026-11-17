using System.Collections.Generic;
using UnityEngine;

namespace Gridline.Native
{
    // Rigidbody vehicle with four custom raycast wheels. The browser model is
    // kept as the tuning reference, while contact and motion are handled by
    // Unity physics instead of moving the chassis directly.
    public sealed class GridlineVehicleController : MonoBehaviour
    {
        public Transform[] FrontWheelSteerPivots;
        public Transform[] WheelSpinNodes;

        [Header("Ferrari 296 GT3")]
        [SerializeField] private float mass = 1305f;
        [SerializeField] private float power = 426000f;
        [SerializeField] private float maxForce = 9150f;
        [SerializeField] private float topSpeed = 293f / 3.6f;
        // Total service-brake capacity for the car.  The browser reference
        // applies this through a 60/40 front/rear bias and a combined-slip
        // limit rather than equal force at every wheel.
        // Keep the Ferrari setup aligned with the browser reference. The
        // native wheel model distributes this total across both axles.
        [SerializeField] private float brakeForce = 15060f;
        [SerializeField] private float gripFront = 1.32f;
        [SerializeField] private float gripRear = 1.39f;
        [SerializeField] private float aeroMultiplier = 1f;

        private const float G = 9.81f;
        // Match the browser reference's dry asphalt SURF_MU.TRACK value.
        // The old 1.42 baseline made the native tire envelope diverge before
        // any vehicle setup or temperature effect was applied.
        private const float TrackMu = 1.30f;
        private const float FuelKg = 70f;
        private const float WheelRadius = 0.36f;
        private const float WheelMountY = 0.36f;
        private const float WheelBase = 2.84f;
        private const float SuspensionRest = 0.58f;
        private const float SuspensionSpring = 62000f;
        private const float SuspensionDamper = 6800f;
        private const float DesiredRideHeight = 0.37f;
        private const float FrontCorneringStiffness = 72000f;
        private const float RearCorneringStiffness = 78000f;
        private const float BrakeBiasFront = 0.60f;
        private const float AbsSlipStart = 0.10f;
        private const float AbsSlipFull = 0.20f;
        // A service-braking wheel should run a small amount slower than the
        // contact patch. Holding it at free-rolling speed leaves positive
        // slip in the brake phase, which feeds the longitudinal tire model in
        // the drive direction and softens the pedal exactly when it should
        // build deceleration.
        private const float BrakeSlipTarget = 0.08f;
        // Match the browser reference's ABS level-4 envelope. The previous
        // 0.72 floor over-released the brakes once the wheel model reported
        // slip, which produced the measured 160-to-0 regression on this build.
        private const float AbsMinimumLongitudinalScale = 0.90f;

        private sealed class WheelState
        {
            public Vector3 localPosition;
            public bool front;
            public bool driven;
            public bool grounded;
            public RaycastHit hit;
            public float wheelOmega;
            public float suspensionLength;
            public float suspensionForce;
            public float slipRatio;
            public float slipAngle;
            public float relaxedSlipAngle;
            public GridlineSurface surface;
            public float wheelForwardSpeed;
            public float driveForce;
            public float serviceBrake;
            public float longitudinalForce;
            public float normalLoad;
            public float maxTireForce;
            public float lateralDemand;
            public float lateralForce;
            public float longitudinalDemand;
            public float combinedLongitudinalLimit;
        }

        private GridlineInputRouter input;
        private GridlineTrackData track;
        private Vector3 spawnPosition;
        private Quaternion spawnRotation;
        private int sampleIndex;
        private float steerAngle;
        private float accelerationLongitudinal;
        private float alphaFront;
        private float alphaRear;
        private float smoothedThrottle;
        private float smoothedBrake;
        private float smoothedSteer;
        private float smoothedHandbrake;
        private bool hillHoldActive;
        private float offTrackTime;
        private float tireTempFront = 78f;
        private float tireTempRear = 78f;
        private float tireWearFront = 1f;
        private float tireWearRear = 1f;
        private float spin;
        private bool reverseEngaged;
        private bool driverInputOverride;
        private bool automatedQaRun;
        private float driverThrottle;
        private float driverBrake;
        private float driverSteering;
        private float driverHandbrake;
        private float stationaryTime;
        private float nextPhysicsLog;
        private float nextBrakeTelemetryLog;
        private float nextManualTelemetryLog;
        private float lastEngineForce;
        private float lastRearDriveForce;
        private float lastFrontLongitudinalForce;
        private float lastRearLongitudinalForce;
        private float lastRearSlipRatio;
        private string lastCollisionName = "none";
        private float lastCollisionImpulse;
        private float lastCollisionFixedTime = -999f;
        private Vector3 previousWorldVelocity;
        private readonly List<Transform> modelWheels = new List<Transform>();
        private WheelState[] wheels;
        private GridlineSurface currentSurface = GridlineSurface.Track;

        public Rigidbody Body { get; private set; }
        public float ThrottleInput => smoothedThrottle;
        public float BrakeInput => reverseEngaged ? 0f : smoothedBrake;
        public float ReverseInput => reverseEngaged ? smoothedBrake : 0f;
        public float SteerInput => smoothedSteer;
        public float HandbrakeInput => smoothedHandbrake;
        public float SpeedKph { get; private set; }
        public int ResetCount { get; private set; }
        public float Rpm { get; private set; }
        public int Gear { get; private set; } = 1;
        public string GearLabel => reverseEngaged ? "R" : Gear.ToString();
        public bool IsRevLimiter => !reverseEngaged && Rpm >= 10850f && SpeedKph > 8f;
        public float LateralG { get; private set; }
        public float LongitudinalG { get; private set; }
        public float MeasuredLateralG { get; private set; }
        public float MeasuredLongitudinalG { get; private set; }
        public float LocalForwardSpeed => Body != null
            ? Vector3.Dot(transform.forward, Body.linearVelocity)
            : 0f;
        public float EngineForceTelemetry => lastEngineForce;
        public float RearDriveForceTelemetry => lastRearDriveForce;
        public float RearLongitudinalForceTelemetry => lastRearLongitudinalForce;
        public float RearSlipRatioTelemetry => lastRearSlipRatio;
        public bool ReverseEngaged => reverseEngaged;
        public string WheelSurfaceTelemetry
        {
            get
            {
                if (wheels == null || wheels.Length == 0) return "none";
                return $"FL={wheels[0].surface};FR={wheels[1].surface};RL={wheels[2].surface};RR={wheels[3].surface}";
            }
        }
        public float YawRate => Body != null
            ? Vector3.Dot(Body.angularVelocity, transform.up)
            : 0f;
        public float AverageWheelLoad { get; private set; }
        public float AverageSuspensionLength { get; private set; }
        public float MaximumSlipRatio { get; private set; }
        public bool AllWheelsGrounded { get; private set; }
        public int GroundedWheelCount { get; private set; }
        public float TrackLateral { get; private set; }
        public float TrackProgress { get; private set; }
        public float TrackDistance { get; private set; }
        public int TrackSampleIndex => sampleIndex;
        public bool OnTrack { get; private set; } = true;
        public float SlipAngle => Mathf.Max(Mathf.Abs(alphaFront), Mathf.Abs(alphaRear));
        public string SurfaceLabel => currentSurface.ToString().ToUpperInvariant();
        public float AverageTireTemp => (tireTempFront + tireTempRear) * 0.5f;
        public float AverageTireWear => (tireWearFront + tireWearRear) * 0.5f;
        public string TireLabel => $"{AverageTireTemp:0}C {AverageTireWear * 100f:0}%";
        public string LastCollisionName => lastCollisionName;
        public float LastCollisionImpulse => lastCollisionImpulse;
        public bool HasRecentCollision => Time.fixedTime - lastCollisionFixedTime
            <= Mathf.Max(Time.fixedDeltaTime * 2f, 0.05f);

        public string WheelForceTelemetry
        {
            get
            {
                if (wheels == null || wheels.Length < 4) return "none";
                return $"FL{FormatWheelTelemetry(wheels[0])} "
                    + $"FR{FormatWheelTelemetry(wheels[1])} "
                    + $"RL{FormatWheelTelemetry(wheels[2])} "
                    + $"RR{FormatWheelTelemetry(wheels[3])}"
                    + $" rawLongG={MeasuredLongitudinalG:0.00}";
            }
        }

        private static string FormatWheelTelemetry(WheelState wheel)
        {
            return $"(load={wheel.normalLoad:0},cap={wheel.maxTireForce:0},"
                + $"brake={wheel.serviceBrake:0},lim={wheel.combinedLongitudinalLimit:0},"
                + $"reqFx={wheel.longitudinalDemand:0},Fx={wheel.longitudinalForce:0},"
                + $"reqFy={wheel.lateralDemand:0},Fy={wheel.lateralForce:0},"
                + $"slip={wheel.slipRatio:0.000},omega={wheel.wheelOmega:0.0},"
                + $"wheelV={wheel.wheelForwardSpeed:0.00},alpha={wheel.slipAngle:0.000})";
        }

        public void SetDriverInput(float throttle, float brake, float steering, float handbrake)
        {
            driverInputOverride = true;
            driverThrottle = Mathf.Clamp01(throttle);
            driverBrake = Mathf.Clamp01(brake);
            driverSteering = Mathf.Clamp(steering, -1f, 1f);
            driverHandbrake = Mathf.Clamp01(handbrake);
        }

        public void ClearDriverInput()
        {
            driverInputOverride = false;
            driverThrottle = 0f;
            driverBrake = 0f;
            driverSteering = 0f;
            driverHandbrake = 0f;
        }

        public void Configure(GridlineTrackData sourceTrack, Vector3 position, Quaternion rotation)
        {
            track = sourceTrack;
            spawnPosition = position;
            spawnRotation = rotation;
            EnsurePhysicsBody();
            ResetCar();
        }

        public void ConfigureSpawnPose(Vector3 position, Quaternion rotation)
        {
            spawnPosition = position;
            spawnRotation = rotation;
        }

        private void Awake()
        {
            input = GridlineInputRouter.Instance;
            automatedQaRun = HasAutomatedQaArgument();
            EnsurePhysicsBody();
        }

        private void Update()
        {
            if (input == null) input = GridlineInputRouter.Instance;

            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter)
                || (Input.GetKeyDown(KeyCode.JoystickButton0) && GridlineGameState.IsMenu))
            {
                if (GridlineGameState.IsMenu) GridlineGameState.StartDriving();
            }
            if (Input.GetKeyDown(KeyCode.Escape)) GridlineGameState.ReturnToMenu();
            if (Input.GetKeyDown(KeyCode.P)) GridlineGameState.TogglePause();
            if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.JoystickButton1)) ResetCar();

            AnimateWheels(Time.deltaTime);
        }

        private void FixedUpdate()
        {
            EnsurePhysicsBody();
            if (Body == null) return;

            if (!GridlineGameState.IsDriving || track == null)
            {
                Body.isKinematic = true;
                return;
            }

            if (GridlineRuntimeBuilder.TimeTrial != null
                && GridlineRuntimeBuilder.TimeTrial.IsManualCountdown)
            {
                if (!Body.isKinematic)
                {
                    Body.linearVelocity = Vector3.zero;
                    Body.angularVelocity = Vector3.zero;
                    Body.isKinematic = true;
                }
                return;
            }

            Body.isKinematic = false;
            float dt = Time.fixedDeltaTime;
            bool raceLocked = GridlineRuntimeBuilder.Race != null
                && GridlineRuntimeBuilder.Race.Enabled
                && !GridlineRuntimeBuilder.Race.IsRaceLive;
            float throttle = raceLocked ? 0f
                : driverInputOverride ? driverThrottle : input != null ? input.Throttle : 0f;
            float brake = raceLocked ? 0f
                : driverInputOverride ? driverBrake : input != null ? input.Brake : 0f;
            float steering = raceLocked ? 0f
                : driverInputOverride ? driverSteering : input != null ? input.Steering : 0f;
            float handbrake = raceLocked ? 0f
                : driverInputOverride ? driverHandbrake : input != null ? input.Handbrake : 0f;
            smoothedThrottle = Mathf.MoveTowards(smoothedThrottle, throttle, dt * 12f);
            // Match the browser pedal envelope: pressure builds progressively
            // instead of snapping to full braking in a few fixed steps.
            float brakeRate = brake > smoothedBrake ? 4f : 7.2f;
            smoothedBrake = Mathf.MoveTowards(smoothedBrake, brake, dt * brakeRate);
            // Keep steering response aligned with the browser reference. A
            // direct 10/s chase makes a small controller or wheel movement
            // become near-full lock within a few fixed steps. GT3 steering
            // builds progressively, returns faster, and changes direction
            // quickly enough for a deliberate catch.
            float steerRate = Mathf.Abs(steering) < 0.02f
                ? 4.8f
                : Mathf.Abs(smoothedSteer) > 0.02f
                    && Mathf.Sign(steering) != Mathf.Sign(smoothedSteer)
                    ? 5.1f
                    : 2.3f;
            smoothedSteer = Mathf.MoveTowards(smoothedSteer, steering, dt * steerRate);
            smoothedHandbrake = Mathf.MoveTowards(smoothedHandbrake, handbrake, dt * 20f);

            StepPhysics(dt);
            UpdatePowertrain();
        }

        private void StepPhysics(float dt)
        {
            // Collision callbacks arrive after the physics step. Clear the
            // previous frame's label so telemetry cannot report an old barrier
            // contact while the car is currently on clean asphalt.
            lastCollisionName = "none";
            lastCollisionImpulse = 0f;
            GridlineTrackData.Sample sample = track.Query(transform.position, sampleIndex);
            sampleIndex = sample.index;
            TrackLateral = sample.lateral;
            TrackProgress = sample.progress;
            TrackDistance = sample.distance;
            OnTrack = sample.onTrack;

            Vector3 localVelocity = transform.InverseTransformDirection(Body.linearVelocity);
            float forwardSpeed = localVelocity.z;
            float speed = Body.linearVelocity.magnitude;
            bool keyboardReverseCommand = input != null && input.KeyboardBrakeHeld;
            if (smoothedThrottle > 0.05f || keyboardReverseCommand)
                hillHoldActive = false;
            else if (smoothedBrake > 0.05f && speed < 2f)
                hillHoldActive = true;
            if (hillHoldActive && !keyboardReverseCommand && smoothedThrottle < 0.05f
                && speed < 0.75f && GroundedWheelCount > 0)
            {
                Body.linearVelocity = Vector3.zero;
                Body.angularVelocity = Vector3.zero;
                localVelocity = Vector3.zero;
                forwardSpeed = 0f;
                speed = 0f;
            }
            bool nearlyStationary = speed < 0.45f && Mathf.Abs(forwardSpeed) < 0.4f
                && Mathf.Abs(localVelocity.x) < 0.3f;
            stationaryTime = nearlyStationary ? stationaryTime + dt : 0f;
            bool canSelectReverse = stationaryTime >= 0.35f;
            if (!reverseEngaged && keyboardReverseCommand && smoothedBrake > 0.35f
                && canSelectReverse && smoothedThrottle < 0.05f)
                reverseEngaged = true;
            if (reverseEngaged && (smoothedThrottle > 0.08f || (smoothedBrake < 0.05f && Mathf.Abs(forwardSpeed) < 0.2f)))
                reverseEngaged = false;

            float maxSteer = 0.38f / (1f + speed * 0.035f);
            steerAngle = Mathf.MoveTowards(steerAngle, smoothedSteer * maxSteer, 3.6f * dt);
            float engineForce = ComputeEngineForce(forwardSpeed);
            lastEngineForce = engineForce;
            lastRearDriveForce = 0f;
            lastFrontLongitudinalForce = 0f;
            lastRearLongitudinalForce = 0f;
            lastRearSlipRatio = 0f;
            float frontGrip = gripFront / 1.30f * TrackMu;
            float rearGrip = gripRear / 1.30f * TrackMu;
            float frontSlipSum = 0f;
            float rearSlipSum = 0f;
            int frontCount = 0;
            int rearCount = 0;
            bool anyGrounded = false;
            GridlineSurface dominantSurface = sample.surface;
            float largestLoad = 0f;

            if (wheels == null) InitializeWheels();
            for (int i = 0; i < wheels.Length; i += 1)
            {
                WheelState wheel = wheels[i];
                Vector3 mount = transform.TransformPoint(wheel.localPosition);
                // The ray starts at the physical wheel carrier. SuspensionRest
                // is travel, not an extra offset above the carrier. The old
                // offset made the body hover at the wrong height and distorted
                // every wheel load during braking and cornering.
                Vector3 rayOrigin = mount;
                float rayLength = SuspensionRest + WheelRadius + 0.10f;
                if (!TryWheelHit(rayOrigin, -transform.up, rayLength, out RaycastHit hit))
                {
                    wheel.grounded = false;
                    wheel.suspensionForce = 0f;
                    wheel.suspensionLength = SuspensionRest;
                    wheel.normalLoad = 0f;
                    wheel.maxTireForce = 0f;
                    wheel.lateralDemand = 0f;
                    wheel.lateralForce = 0f;
                    wheel.longitudinalDemand = 0f;
                    wheel.longitudinalForce = 0f;
                    wheel.combinedLongitudinalLimit = 0f;
                    wheel.wheelOmega = Mathf.Lerp(wheel.wheelOmega,
                        Vector3.Dot(Body.GetPointVelocity(mount), transform.forward) / WheelRadius, dt * 6f);
                    continue;
                }

                wheel.grounded = true;
                wheel.hit = hit;
                wheel.surface = GridlineTrackCollision.SurfaceFor(hit.collider);
                wheel.suspensionLength = Mathf.Clamp(hit.distance - WheelRadius, 0.04f, SuspensionRest);
                float compression = Mathf.Clamp(SuspensionRest - wheel.suspensionLength, 0f, SuspensionRest);
                float suspensionVelocity = Vector3.Dot(Body.GetPointVelocity(mount), transform.up);
                float rideHeight = Vector3.Dot(transform.position - hit.point, transform.up);
                float rideHeightError = rideHeight - DesiredRideHeight;
                float staticWheelLoad = Body.mass * G * 0.25f;
                wheel.suspensionForce = Mathf.Clamp(
                    staticWheelLoad - rideHeightError * SuspensionSpring
                    - suspensionVelocity * SuspensionDamper,
                    0f,
                    21000f);
                if (wheel.suspensionForce <= 1f) continue;

                anyGrounded = true;
                GridlineSurface surface = wheel.surface;
                GridlineSurface gripSurface = surface == GridlineSurface.Barrier
                    ? GridlineSurface.Track : surface;
                if (wheel.suspensionForce > largestLoad)
                {
                    largestLoad = wheel.suspensionForce;
                    dominantSurface = surface;
                }

                float surfaceGrip = SurfaceGrip(gripSurface);
                float wear = wheel.front ? tireWearFront : tireWearRear;
                float temperature = wheel.front ? tireTempFront : tireTempRear;
                float mu = (wheel.front ? frontGrip : rearGrip) * surfaceGrip
                    * TemperatureGrip(temperature) * wear;
                float normalLoad = Mathf.Max(wheel.suspensionForce, mass * G * 0.12f);
                float maxTireForce = mu * normalLoad;
                wheel.normalLoad = normalLoad;
                wheel.maxTireForce = maxTireForce;

                Quaternion steeringRotation = wheel.front
                    ? Quaternion.AngleAxis(steerAngle * Mathf.Rad2Deg, transform.up)
                    : Quaternion.identity;
                Vector3 wheelForward = steeringRotation * transform.forward;
                Vector3 wheelRight = Vector3.Cross(transform.up, wheelForward).normalized;
                Vector3 pointVelocity = Body.GetPointVelocity(hit.point);
                float wheelForwardSpeed = Vector3.Dot(pointVelocity, wheelForward);
                float wheelLateralSpeed = Vector3.Dot(pointVelocity, wheelRight);
                float driveForce = wheel.driven ? engineForce * 0.5f : 0f;
                // Keep the rear axle from saturating first under trail
                // braking.  brakeForce is the car total; split it per wheel
                // so front and rear receive 60/40 respectively.
                float axleBias = wheel.front ? BrakeBiasFront : 1f - BrakeBiasFront;
                float serviceBrake = reverseEngaged ? 0f
                    : smoothedBrake * brakeForce * axleBias * 0.5f;
                if (!wheel.front) serviceBrake += smoothedHandbrake * brakeForce * 0.44f;

                float freeOmega = wheelForwardSpeed / WheelRadius;
                float overload = wheel.driven && maxTireForce > 1f
                    ? Mathf.Max(0f, Mathf.Abs(driveForce) - maxTireForce) / maxTireForce
                    : 0f;
                float omegaTarget = freeOmega + Mathf.Sign(driveForce) * overload
                    * Mathf.Max(Mathf.Abs(wheelForwardSpeed), 4f) / WheelRadius;
                if (serviceBrake > 0f && Mathf.Abs(wheelForwardSpeed) > 1f)
                {
                    float brakingSign = Mathf.Sign(wheelForwardSpeed);
                    omegaTarget = freeOmega * (1f - BrakeSlipTarget * smoothedBrake)
                        * brakingSign;
                }
                else if (serviceBrake > 0f)
                {
                    omegaTarget = 0f;
                }
                float wheelOmegaResponse = serviceBrake > 0f
                    ? 14f
                    : wheel.driven ? 8f : 40f;
                wheel.wheelOmega = Mathf.Lerp(wheel.wheelOmega, omegaTarget,
                    1f - Mathf.Exp(-dt * wheelOmegaResponse));

                wheel.slipRatio = (wheel.wheelOmega * WheelRadius - wheelForwardSpeed)
                    / Mathf.Max(Mathf.Abs(wheelForwardSpeed), 4f);

                float rawSlipAngle = Mathf.Atan2(-wheelLateralSpeed,
                    Mathf.Max(Mathf.Abs(wheelForwardSpeed), 4f));
                // Match the browser tire response: the carcass does not jump
                // to a new slip angle in one solver step, and lateral force
                // rises through a soft Pacejka curve instead of hitting the
                // friction-circle clamp abruptly.
                float relaxation = Mathf.Clamp(
                    Mathf.Max(Mathf.Abs(wheelForwardSpeed) * dt / 0.45f, dt / 0.15f),
                    0f,
                    1f);
                wheel.relaxedSlipAngle = Mathf.Lerp(wheel.relaxedSlipAngle,
                    rawSlipAngle, relaxation);
                float corneringStiffness = wheel.front ? FrontCorneringStiffness : RearCorneringStiffness;
                float tireShape = Mathf.Sin(1.30f * Mathf.Atan(
                    (corneringStiffness / Mathf.Max(maxTireForce, 1f)) * wheel.relaxedSlipAngle));
                float lateralDemand = tireShape * maxTireForce
                    - wheelLateralSpeed * 1450f;
                wheel.lateralDemand = lateralDemand;

                // ABS is deliberately expressed as a combined-slip limit,
                // not as an arcade speed clamp.  Lateral tire demand reduces
                // the braking envelope, which keeps steering authority while
                // trail braking and makes the transition progressive.
                float lateralUse = Mathf.Clamp01(
                    Mathf.Abs(lateralDemand) / Mathf.Max(maxTireForce, 1f));
                float absLongitudinalLimit = maxTireForce * 0.96f
                    * Mathf.Sqrt(Mathf.Max(0.04f, 1f - lateralUse * lateralUse));
                float slipAbs = Mathf.Abs(wheel.slipRatio);
                float absRelease = Mathf.InverseLerp(AbsSlipStart, AbsSlipFull, slipAbs);
                absLongitudinalLimit *= Mathf.Lerp(1f,
                    AbsMinimumLongitudinalScale, absRelease);
                // Positive slip means the contact patch is driving the car
                // forward; negative slip must create a resisting force. The
                // previous subtraction inverted that sign, making a free
                // rolling front wheel generate artificial propulsion and
                // consume its entire lateral friction reserve while steering.
                float longitudinalDemand = driveForce + wheel.slipRatio * 9200f;
                // Low-grip surfaces can saturate the tire, but positive engine
                // torque must never become a backwards tire force because the
                // slip correction overshot the available traction.
                if (driveForce > 0f) longitudinalDemand = Mathf.Max(0f, longitudinalDemand);
                else if (driveForce < 0f) longitudinalDemand = Mathf.Min(0f, longitudinalDemand);
                if (serviceBrake > 0f)
                    longitudinalDemand -= Mathf.Sign(wheelForwardSpeed == 0f ? wheel.wheelOmega : wheelForwardSpeed) * serviceBrake;
                float longitudinalForce = Mathf.Clamp(longitudinalDemand, -maxTireForce, maxTireForce);
                if (serviceBrake > 0f && Mathf.Abs(wheelForwardSpeed) > 1f)
                {
                    float brakingSign = Mathf.Sign(wheelForwardSpeed);
                    if (brakingSign > 0f)
                        longitudinalForce = Mathf.Max(longitudinalForce, -absLongitudinalLimit);
                    else
                        longitudinalForce = Mathf.Min(longitudinalForce, absLongitudinalLimit);
                }
                wheel.wheelForwardSpeed = wheelForwardSpeed;
                wheel.driveForce = driveForce;
                wheel.serviceBrake = serviceBrake;
                wheel.longitudinalDemand = longitudinalDemand;
                wheel.combinedLongitudinalLimit = absLongitudinalLimit;
                wheel.longitudinalForce = longitudinalForce;
                if (wheel.front)
                {
                    lastFrontLongitudinalForce += longitudinalForce;
                }
                else
                {
                    lastRearDriveForce += driveForce;
                    lastRearLongitudinalForce += longitudinalForce;
                    lastRearSlipRatio = Mathf.Max(lastRearSlipRatio, Mathf.Abs(wheel.slipRatio));
                }
                float lateralReserve = Mathf.Sqrt(Mathf.Max(0f, maxTireForce * maxTireForce
                    - longitudinalForce * longitudinalForce));
                float lateralForce = Mathf.Clamp(lateralDemand, -lateralReserve, lateralReserve);
                wheel.lateralForce = lateralForce;
                wheel.slipAngle = wheel.relaxedSlipAngle;

                Body.AddForceAtPosition(
                    wheelForward * longitudinalForce
                    + wheelRight * lateralForce
                    + transform.up * wheel.suspensionForce,
                    hit.point,
                    ForceMode.Force);

                if (wheel.front)
                {
                    frontSlipSum += wheel.slipAngle;
                    frontCount += 1;
                }
                else
                {
                    rearSlipSum += wheel.slipAngle;
                    rearCount += 1;
                }
            }

            float totalWheelLoad = 0f;
            float totalSuspensionLength = 0f;
            float maximumSlipRatio = 0f;
            int groundedWheels = 0;
            for (int i = 0; i < wheels.Length; i += 1)
            {
                WheelState wheel = wheels[i];
                totalWheelLoad += wheel.suspensionForce;
                totalSuspensionLength += wheel.suspensionLength;
                maximumSlipRatio = Mathf.Max(maximumSlipRatio, Mathf.Abs(wheel.slipRatio));
                if (wheel.grounded) groundedWheels += 1;
            }
            AverageWheelLoad = totalWheelLoad / Mathf.Max(wheels.Length, 1);
            AverageSuspensionLength = totalSuspensionLength / Mathf.Max(wheels.Length, 1);
            MaximumSlipRatio = maximumSlipRatio;
            AllWheelsGrounded = groundedWheels == wheels.Length;
            GroundedWheelCount = groundedWheels;

            currentSurface = dominantSurface;
            alphaFront = frontCount > 0 ? frontSlipSum / frontCount : alphaFront * 0.94f;
            alphaRear = rearCount > 0 ? rearSlipSum / rearCount : alphaRear * 0.94f;
            ApplyStabilityAssist(speed, forwardSpeed, dominantSurface, frontCount, rearCount,
                frontSlipSum, rearSlipSum);
            UpdateTireModel(dt, speed);

            float setupMass = mass + FuelKg * 0.72f;
            float aeroDownforce = 0.55f * aeroMultiplier * setupMass * G
                * (speed * speed / Mathf.Max(topSpeed * topSpeed, 1f));
            float dragCoefficient = power / Mathf.Max(topSpeed * topSpeed * topSpeed, 1f);
            Body.AddForce(-Body.linearVelocity * dragCoefficient * speed, ForceMode.Force);
            Body.AddForce(-transform.up * aeroDownforce, ForceMode.Force);
            if (!anyGrounded) currentSurface = sample.surface;

            // Differentiate world velocity first. Differentiating velocity
            // after transforming it into the rotating car frame cancels the
            // centripetal component in a steady corner and falsely reports
            // almost zero lateral G on a skidpad.
            Vector3 worldAcceleration = (Body.linearVelocity - previousWorldVelocity) / dt;
            float measuredLongitudinal = Vector3.Dot(worldAcceleration, transform.forward);
            float measuredLateral = Vector3.Dot(worldAcceleration, transform.right);
            MeasuredLongitudinalG = measuredLongitudinal / G;
            MeasuredLateralG = measuredLateral / G;
            LateralG = Mathf.Lerp(LateralG, measuredLateral / G, 0.22f);
            LongitudinalG = Mathf.Lerp(LongitudinalG, measuredLongitudinal / G, 0.22f);
            previousWorldVelocity = Body.linearVelocity;
            accelerationLongitudinal = measuredLongitudinal;
            SpeedKph = Body.linearVelocity.magnitude * 3.6f;

            if (!reverseEngaged && smoothedBrake > 0.05f
                && Time.unscaledTime >= nextBrakeTelemetryLog)
            {
                nextBrakeTelemetryLog = Time.unscaledTime + (automatedQaRun ? 0.5f : 0.25f);
                Debug.Log($"Gridline brake telemetry input={smoothedBrake:0.00} "
                    + $"speed={SpeedKph:0.0}kph longG={LongitudinalG:0.00} "
                    + $"latG={LateralG:0.00} slip={MaximumSlipRatio:0.000} "
                    + $"yaw={YawRate:0.000}rad/s surface={currentSurface} "
                    + $"grounded={groundedWheels}/4 localV={LocalForwardSpeed:0.00}"
                    + (automatedQaRun ? $" {WheelForceTelemetry}" : string.Empty));
            }

            if (!automatedQaRun && !driverInputOverride
                && (smoothedThrottle > 0.05f || smoothedBrake > 0.05f
                    || Mathf.Abs(smoothedSteer) > 0.03f)
                && Time.unscaledTime >= nextManualTelemetryLog)
            {
                nextManualTelemetryLog = Time.unscaledTime + 0.25f;
                Debug.Log($"Gridline manual telemetry throttle={smoothedThrottle:0.00} "
                    + $"brake={smoothedBrake:0.00} steer={smoothedSteer:0.00} "
                    + $"source={input?.ActiveInputSource ?? "NONE"} "
                    + $"rawWheelBrake={input?.RawWheelBrake ?? 0f:0.00} "
                    + $"speed={SpeedKph:0.0}kph longG={LongitudinalG:0.00} "
                    + $"latG={LateralG:0.00} slip={MaximumSlipRatio:0.000} "
                    + $"slipAngle={SlipAngle:0.000} yaw={YawRate:0.000}rad/s "
                    + $"frontFx={lastFrontLongitudinalForce:0} rearFx={lastRearLongitudinalForce:0} "
                    + $"hillHold={hillHoldActive} reverse={reverseEngaged} "
                    + $"surface={currentSurface} grounded={groundedWheels}/4 "
                    + $"localV={LocalForwardSpeed:0.00} collision={lastCollisionName}");
            }

            if (Time.unscaledTime >= nextPhysicsLog)
            {
                nextPhysicsLog = Time.unscaledTime + 2f;
                int groundedCount = 0;
                for (int i = 0; i < wheels.Length; i += 1) if (wheels[i].grounded) groundedCount += 1;
                Debug.Log($"Gridline physics pos={transform.position} speed={SpeedKph:0.0} "
                    + $"grounded={groundedCount}/4 surface={currentSurface} collision={lastCollisionName} "
                    + $"localV={LocalForwardSpeed:0.00} engineFx={lastEngineForce:0} "
                    + $"rearDriveFx={lastRearDriveForce:0} rearTireFx={lastRearLongitudinalForce:0} "
                    + $"rearSlip={lastRearSlipRatio:0.000} reverse={reverseEngaged} "
                    + $"bodyKinematic={Body.isKinematic} wheelFL={wheels[0].suspensionLength:0.000}m/"
                    + $"{wheels[0].suspensionForce:0}N vy={Body.linearVelocity.y:0.00}");
            }

            if (Mathf.Abs(TrackLateral) > track.halfWidth + 1.5f) offTrackTime += dt;
            else offTrackTime = 0f;
            if (transform.position.y < -20f || (offTrackTime > 8f && Mathf.Abs(TrackLateral) > track.halfWidth + 30f))
                ResetCar();
        }

        private void ApplyStabilityAssist(float speed, float forwardSpeed, GridlineSurface dominantSurface,
            int frontCount, int rearCount, float frontSlipSum, float rearSlipSum)
        {
            if (frontCount == 0 && rearCount == 0) return;

            // This is the same gentle safety layer used by the browser model:
            // steer toward the physically available yaw rate and bleed excess
            // lateral velocity before it becomes a snap spin.
            float surfaceGrip = SurfaceGrip(dominantSurface == GridlineSurface.Barrier
                ? GridlineSurface.Track : dominantSurface);
            float aeroLoad = 1f + 0.55f * aeroMultiplier
                * (speed * speed / Mathf.Max(topSpeed * topSpeed, 1f));
            float lateralLimit = G * TrackMu * surfaceGrip * aeroLoad;
            float yawLimit = lateralLimit / Mathf.Max(Mathf.Abs(forwardSpeed), 5f);
            float kinematicYaw = forwardSpeed / WheelBase * Mathf.Tan(steerAngle);
            float desiredYaw = Mathf.Clamp(kinematicYaw, -yawLimit, yawLimit);

            float frontSlip = frontCount > 0 ? Mathf.Abs(frontSlipSum / frontCount) : 0f;
            float rearSlip = rearCount > 0 ? Mathf.Abs(rearSlipSum / rearCount) : 0f;
            float maxSlip = Mathf.Max(frontSlip, rearSlip);
            float overLimit = Mathf.Clamp01((maxSlip - 0.22f) * 4.2f);
            // Match the browser reference: stabilize strongly while the car
            // is inside the available grip envelope, then back off smoothly
            // as the tires saturate so a genuine slide remains recoverable.
            float assistFactor = Mathf.Clamp(1f - overLimit * 0.42f, 0.16f, 1f);
            float yawRate = Vector3.Dot(Body.angularVelocity, transform.up);
            float lateralSpeed = Vector3.Dot(Body.linearVelocity, transform.right);

            Body.AddTorque(transform.up * (desiredYaw - yawRate) * 5.4f * assistFactor,
                ForceMode.Acceleration);
            Body.AddForce(-transform.right * lateralSpeed * 3.2f * assistFactor,
                ForceMode.Acceleration);

            // A little extra rear support under power mirrors the GT3 traction
            // behaviour in the browser and keeps throttle application catchable.
            if (smoothedThrottle > 0.35f && speed > 5f)
            {
                Body.AddTorque(-transform.up * yawRate * 0.12f * smoothedThrottle,
                    ForceMode.Acceleration);
            }
        }

        private static float SurfaceGrip(GridlineSurface surface)
        {
            switch (surface)
            {
                case GridlineSurface.Kerb: return 0.84f;
                case GridlineSurface.Grass: return 0.48f;
                case GridlineSurface.Runoff: return 0.38f;
                case GridlineSurface.Gravel: return 0.25f;
                default: return 1f;
            }
        }

        private bool TryWheelHit(Vector3 origin, Vector3 direction, float distance, out RaycastHit closest)
        {
            RaycastHit[] hits = Physics.RaycastAll(origin, direction, distance, ~0, QueryTriggerInteraction.Ignore);
            float bestDistance = float.PositiveInfinity;
            closest = default(RaycastHit);
            bool found = false;
            for (int i = 0; i < hits.Length; i += 1)
            {
                RaycastHit hit = hits[i];
                if (hit.rigidbody == Body || hit.collider.transform.IsChildOf(transform)) continue;
                if (hit.distance < bestDistance)
                {
                    bestDistance = hit.distance;
                    closest = hit;
                    found = true;
                }
            }
            return found;
        }

        private void OnCollisionEnter(Collision collision)
        {
            RecordCollision(collision);
        }

        private void OnCollisionStay(Collision collision)
        {
            RecordCollision(collision);
        }

        private void RecordCollision(Collision collision)
        {
            if (collision == null || collision.collider == null) return;
            lastCollisionName = collision.collider.name;
            lastCollisionImpulse = Mathf.Max(lastCollisionImpulse, collision.impulse.magnitude);
            lastCollisionFixedTime = Time.fixedTime;
        }

        private float ComputeEngineForce(float forwardSpeed)
        {
            if (reverseEngaged) return -maxForce * 0.42f * smoothedBrake;
            if (smoothedThrottle <= 0.01f) return 0f;
            float speed = Mathf.Abs(forwardSpeed);
            float speedForce = Mathf.Min(maxForce, power / Mathf.Max(speed, 4f));
            float rpmBand = Mathf.InverseLerp(0.1f, topSpeed, speed);
            float torqueShape = Mathf.Lerp(1.08f, 0.76f, rpmBand);
            return speedForce * torqueShape * smoothedThrottle;
        }

        private void UpdatePowertrain()
        {
            if (reverseEngaged)
            {
                Gear = -1;
                Rpm = Mathf.Lerp(Rpm, Mathf.Lerp(1200f, 5000f, smoothedBrake), 0.22f);
                return;
            }

            float speed = Mathf.Abs(Vector3.Dot(transform.forward, Body.linearVelocity));
            float[] gearTops = { 0f, topSpeed * 0.16f, topSpeed * 0.27f, topSpeed * 0.40f,
                topSpeed * 0.55f, topSpeed * 0.74f, topSpeed };
            Gear = 1;
            for (int i = 1; i < gearTops.Length - 1; i += 1)
            {
                if (speed > gearTops[i]) Gear = i + 1;
            }

            float lower = gearTops[Mathf.Clamp(Gear - 1, 0, gearTops.Length - 1)];
            float upper = gearTops[Mathf.Clamp(Gear, 1, gearTops.Length - 1)];
            Rpm = Mathf.Clamp(
                Mathf.Lerp(2900f, 11200f, Mathf.InverseLerp(lower, upper, speed)) + smoothedThrottle * 700f,
                1200f,
                11850f);
        }

        private void UpdateTireModel(float dt, float speed)
        {
            float frontEnergy = Mathf.Abs(alphaFront) * speed * 0.82f + smoothedBrake * speed * 0.15f;
            float rearEnergy = Mathf.Abs(alphaRear) * speed * 0.82f + smoothedThrottle * speed * 0.07f;
            float cooling = 0.10f + speed * 0.0022f;
            tireTempFront = Mathf.Clamp(tireTempFront + frontEnergy * 10f * dt
                - (tireTempFront - 78f) * cooling * dt, 45f, 130f);
            tireTempRear = Mathf.Clamp(tireTempRear + rearEnergy * 10f * dt
                - (tireTempRear - 78f) * cooling * dt, 45f, 130f);
            tireWearFront = Mathf.Clamp01(tireWearFront
                - (frontEnergy * 0.000020f + smoothedBrake * speed * 0.0000007f) * dt);
            tireWearRear = Mathf.Clamp01(tireWearRear
                - (rearEnergy * 0.000020f + smoothedThrottle * speed * 0.0000005f) * dt);
        }

        private static float TemperatureGrip(float temperature)
        {
            if (temperature < 74f) return Mathf.Lerp(0.84f, 0.99f, Mathf.InverseLerp(45f, 74f, temperature));
            if (temperature <= 96f) return 1f;
            return Mathf.Lerp(1f, 0.80f, Mathf.InverseLerp(96f, 130f, temperature));
        }

        public void ResetCar()
        {
            ResetCount += 1;
            EnsurePhysicsBody();
            if (Body != null)
            {
                Body.isKinematic = true;
                Body.position = spawnPosition;
                Body.rotation = spawnRotation;
                Body.isKinematic = false;
                Body.linearVelocity = Vector3.zero;
                Body.angularVelocity = Vector3.zero;
                Body.isKinematic = !GridlineGameState.IsDriving;
            }
            else
            {
                transform.SetPositionAndRotation(spawnPosition, spawnRotation);
            }

            smoothedThrottle = 0f;
            smoothedBrake = 0f;
            smoothedSteer = 0f;
            smoothedHandbrake = 0f;
            steerAngle = 0f;
            reverseEngaged = false;
            hillHoldActive = true;
            stationaryTime = 0f;
            SpeedKph = 0f;
            Rpm = 1200f;
            Gear = 1;
            TrackLateral = 0f;
            TrackProgress = 0f;
            TrackDistance = 0f;
            sampleIndex = 0;
            offTrackTime = 0f;
            currentSurface = GridlineSurface.Track;
            accelerationLongitudinal = 0f;
            alphaFront = 0f;
            alphaRear = 0f;
            LateralG = 0f;
            LongitudinalG = 0f;
            AverageWheelLoad = 0f;
            AverageSuspensionLength = SuspensionRest;
            MaximumSlipRatio = 0f;
            AllWheelsGrounded = false;
            GroundedWheelCount = 0;
            tireTempFront = 78f;
            tireTempRear = 78f;
            tireWearFront = 1f;
            tireWearRear = 1f;
            spin = 0f;
            lastEngineForce = 0f;
            lastRearDriveForce = 0f;
            lastFrontLongitudinalForce = 0f;
            lastRearLongitudinalForce = 0f;
            lastRearSlipRatio = 0f;
            previousWorldVelocity = Vector3.zero;
            lastCollisionName = "none";
            lastCollisionImpulse = 0f;
            lastCollisionFixedTime = -999f;
            driverThrottle = 0f;
            driverBrake = 0f;
            driverSteering = 0f;
            driverHandbrake = 0f;
            InitializeWheels();
            if (GridlineRuntimeBuilder.LapSystem != null) GridlineRuntimeBuilder.LapSystem.ResetSession();
        }

        public void ResetForQa(Vector3 position, Quaternion rotation)
        {
            ConfigureSpawnPose(position, rotation);
            ResetCar();
        }

        public void BindVisualModel(Transform modelRoot)
        {
            modelWheels.Clear();
            if (modelRoot == null) return;
            modelRoot.GetComponentsInChildren(true, modelWheels);
            modelWheels.RemoveAll(wheel => wheel == null || !IsWheelName(wheel.name));
        }

        private void InitializeWheels()
        {
            wheels = new[]
            {
                new WheelState { localPosition = new Vector3(-0.92f, WheelMountY, 1.42f), front = true, driven = false },
                new WheelState { localPosition = new Vector3(0.92f, WheelMountY, 1.42f), front = true, driven = false },
                new WheelState { localPosition = new Vector3(-0.92f, WheelMountY, -1.42f), front = false, driven = true },
                new WheelState { localPosition = new Vector3(0.92f, WheelMountY, -1.42f), front = false, driven = true }
            };
        }

        private void EnsurePhysicsBody()
        {
            if (Body == null) Body = GetComponent<Rigidbody>() ?? gameObject.AddComponent<Rigidbody>();
            Body.mass = mass + FuelKg * 0.72f;
            Body.linearDamping = 0.015f;
            Body.angularDamping = 0.62f;
            Body.useGravity = true;
            Body.interpolation = RigidbodyInterpolation.Interpolate;
            Body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            Body.centerOfMass = new Vector3(0f, 0.30f, 0f);
            if (GetComponent<BoxCollider>() == null)
            {
                BoxCollider collider = gameObject.AddComponent<BoxCollider>();
                collider.center = new Vector3(0f, 0.24f, 0f);
                collider.size = new Vector3(1.90f, 0.32f, 4.35f);
                collider.material = CreateLowSnagMaterial();
            }
            if (wheels == null) InitializeWheels();
            gameObject.layer = 2;
        }

        private static PhysicsMaterial CreateLowSnagMaterial()
        {
            PhysicsMaterial material = new PhysicsMaterial("Gridline vehicle body")
            {
                dynamicFriction = 0.18f,
                staticFriction = 0.18f,
                bounciness = 0f,
                frictionCombine = PhysicsMaterialCombine.Minimum,
                bounceCombine = PhysicsMaterialCombine.Minimum
            };
            return material;
        }

        private static bool IsWheelName(string name)
        {
            string lower = name.ToLowerInvariant();
            return lower.Contains("wheel") || lower.Contains("tyre") || lower.Contains("tire");
        }

        private static bool HasAutomatedQaArgument()
        {
            string[] args = System.Environment.GetCommandLineArgs();
            string[] qaArguments =
            {
                "-gridline-qa-vehicle",
                "-gridline-qa-tyre-interaction",
                "-gridline-qa-lap",
                "-gridline-qa-time-trial",
                "-gridline-qa-time-trial-restart",
                "-gridline-qa-race",
                "-gridline-qa-rules",
                "-gridline-qa-grass",
                "-gridline-qa-surfaces",
                "-gridline-qa-track-sweep",
                "-gridline-qa-spawn"
            };
            for (int i = 0; i < args.Length; i += 1)
            {
                for (int j = 0; j < qaArguments.Length; j += 1)
                    if (args[i].Equals(qaArguments[j], System.StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private void AnimateWheels(float dt)
        {
            float steerDegrees = steerAngle * Mathf.Rad2Deg;
            if (FrontWheelSteerPivots != null)
            {
                foreach (Transform pivot in FrontWheelSteerPivots)
                    if (pivot != null) pivot.localRotation = Quaternion.Euler(0f, steerDegrees, 0f);
            }

            float frontOmega = wheels != null && wheels.Length > 1
                ? (wheels[0].wheelOmega + wheels[1].wheelOmega) * 0.5f
                : Vector3.Dot(transform.forward, Body != null ? Body.linearVelocity : Vector3.zero) / WheelRadius;
            spin += frontOmega * dt;
            if (WheelSpinNodes != null)
            {
                foreach (Transform wheel in WheelSpinNodes)
                    if (wheel != null) wheel.localRotation = Quaternion.Euler(spin * Mathf.Rad2Deg, 0f, 0f);
            }
            foreach (Transform wheel in modelWheels)
            {
                if (wheel == null) continue;
                wheel.Rotate(Vector3.right, frontOmega * Mathf.Rad2Deg * dt, Space.Self);
            }
        }
    }
}
