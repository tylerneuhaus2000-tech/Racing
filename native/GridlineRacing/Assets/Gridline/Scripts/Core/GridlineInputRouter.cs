using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(-900)]
    public sealed class GridlineInputRouter : MonoBehaviour
    {
        public static GridlineInputRouter Instance { get; private set; }

        public float Throttle { get; private set; }
        public float Brake { get; private set; }
        public float Steering { get; private set; }
        public float Handbrake { get; private set; }
        public bool KeyboardBrakeHeld { get; private set; }

        private float touchThrottle;
        private float touchBrake;
        private float touchSteering;
        private float touchHandbrake;
        private float lastTouchTime = -1f;
        private float wheelThrottleRest;
        private float wheelBrakeRest;
        private int wheelThrottleDirection;
        private int wheelBrakeDirection;
        private bool wheelCalibrationReady;
        private bool externalInputActive;

        public float RawWheelSteering { get; private set; }
        public float RawWheelThrottle { get; private set; }
        public float RawWheelBrake { get; private set; }
        public bool WheelSignalActive { get; private set; }
        public string ActiveInputSource { get; private set; } = "NONE";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.F6)) ResetWheelCalibration();

            if (externalInputActive)
            {
                KeyboardBrakeHeld = false;
                Throttle = Mathf.Clamp01(touchThrottle);
                Brake = Mathf.Clamp01(touchBrake);
                Steering = Mathf.Clamp(touchSteering, -1f, 1f);
                Handbrake = Mathf.Clamp01(touchHandbrake);
                ActiveInputSource = "QA_EXTERNAL";
                return;
            }

            bool touchIsActive = Time.unscaledTime - lastTouchTime < 0.15f;
            if (touchIsActive)
            {
                KeyboardBrakeHeld = false;
                Throttle = Mathf.Clamp01(touchThrottle);
                Brake = Mathf.Clamp01(touchBrake);
                Steering = Mathf.Clamp(touchSteering, -1f, 1f);
                Handbrake = Mathf.Clamp01(touchHandbrake);
                ActiveInputSource = "TOUCH";
                return;
            }

            float axis = Input.GetAxisRaw("Vertical");
            float steeringAxis = Input.GetAxisRaw("Horizontal");
            float wheelSteering = Input.GetAxisRaw("WheelSteering");
            float wheelThrottleRaw = Input.GetAxisRaw("WheelThrottle");
            float wheelBrakeRaw = Input.GetAxisRaw("WheelBrake");
            RawWheelSteering = wheelSteering;
            RawWheelThrottle = wheelThrottleRaw;
            RawWheelBrake = wheelBrakeRaw;
            float keyboardThrottle = Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow) ? 1f : 0f;
            float keyboardBrake = Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow) ? 1f : 0f;
            KeyboardBrakeHeld = keyboardBrake > 0f;
            float keyboardSteering =
                (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) ? 1f : 0f) -
                (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) ? 1f : 0f);

            float analogThrottle = Mathf.Max(0f, axis);
            float analogBrake = Mathf.Max(0f, -axis);
            if (!wheelCalibrationReady)
            {
                wheelThrottleRest = wheelThrottleRaw;
                wheelBrakeRest = wheelBrakeRaw;
                wheelCalibrationReady = true;
            }

            float throttleDelta = wheelThrottleRaw - wheelThrottleRest;
            float brakeDelta = wheelBrakeRaw - wheelBrakeRest;
            if (wheelThrottleDirection == 0 && Mathf.Abs(throttleDelta) > 0.04f)
                wheelThrottleDirection = throttleDelta > 0f ? 1 : -1;
            if (wheelBrakeDirection == 0 && Mathf.Abs(brakeDelta) > 0.04f)
                wheelBrakeDirection = brakeDelta > 0f ? 1 : -1;

            // Wheel pedals are commonly reported as either [-1, 1] or [0, 1].
            // Normalize against the known axis boundary, not the first partial
            // movement, so half pedal cannot temporarily become full pedal.
            float throttleScale = wheelThrottleDirection > 0
                ? Mathf.Max(0.25f, 1f - wheelThrottleRest)
                : Mathf.Max(0.25f, wheelThrottleRest + 1f);
            float brakeScale = wheelBrakeDirection > 0
                ? Mathf.Max(0.25f, 1f - wheelBrakeRest)
                : Mathf.Max(0.25f, wheelBrakeRest + 1f);
            float wheelThrottle = wheelThrottleDirection == 0
                ? 0f
                : Mathf.Clamp01((throttleDelta * wheelThrottleDirection) / throttleScale);
            float wheelBrake = wheelBrakeDirection == 0
                ? 0f
                : Mathf.Clamp01((brakeDelta * wheelBrakeDirection) / brakeScale);
            if (analogThrottle < 0.08f) analogThrottle = 0f;
            if (analogBrake < 0.08f) analogBrake = 0f;
            if (wheelThrottle < 0.04f) wheelThrottle = 0f;
            if (wheelBrake < 0.04f) wheelBrake = 0f;
            steeringAxis = ApplyCenteredDeadzone(steeringAxis, 0.06f);
            wheelSteering = ApplyCenteredDeadzone(wheelSteering, 0.04f);

            Throttle = Mathf.Clamp01(Mathf.Max(keyboardThrottle, analogThrottle, wheelThrottle));
            Brake = Mathf.Clamp01(Mathf.Max(keyboardBrake, analogBrake, wheelBrake));
            if (Brake > 0.04f && Throttle > 0.04f)
                Throttle = 0f;
            float selectedSteering = Mathf.Abs(wheelSteering) > Mathf.Abs(steeringAxis) ? wheelSteering : steeringAxis;
            Steering = Mathf.Abs(selectedSteering) > Mathf.Abs(keyboardSteering) ? selectedSteering : keyboardSteering;
            Handbrake = Input.GetKey(KeyCode.Space) ? 1f : 0f;
            WheelSignalActive = Mathf.Abs(RawWheelSteering) > 0.08f
                || wheelThrottle > 0.04f || wheelBrake > 0.04f;
            ActiveInputSource = WheelSignalActive ? "WHEEL"
                : Mathf.Abs(steeringAxis) > 0.06f || Mathf.Abs(axis) > 0.08f ? "CONTROLLER"
                : keyboardThrottle > 0f || keyboardBrake > 0f || Mathf.Abs(keyboardSteering) > 0f ? "KEYBOARD"
                : "NONE";
        }

        public void SetTouchInput(float throttle, float brake, float steering, float handbrake)
        {
            externalInputActive = false;
            touchThrottle = throttle;
            touchBrake = brake;
            touchSteering = steering;
            touchHandbrake = handbrake;
            lastTouchTime = Time.unscaledTime;
        }

        public void SetExternalWheelInput(float throttle, float brake, float steering, float handbrake)
        {
            externalInputActive = true;
            touchThrottle = throttle;
            touchBrake = brake;
            touchSteering = steering;
            touchHandbrake = handbrake;
            lastTouchTime = Time.unscaledTime;
        }

        public void ResetWheelCalibration()
        {
            wheelCalibrationReady = false;
            wheelThrottleDirection = 0;
            wheelBrakeDirection = 0;
            RawWheelSteering = 0f;
            RawWheelThrottle = 0f;
            RawWheelBrake = 0f;
            WheelSignalActive = false;
            ActiveInputSource = "NONE";
        }

        private static float ApplyCenteredDeadzone(float value, float deadzone)
        {
            float magnitude = Mathf.Abs(value);
            if (magnitude <= deadzone) return 0f;
            return Mathf.Sign(value) * Mathf.Clamp01((magnitude - deadzone) / (1f - deadzone));
        }
    }
}
