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

        private float touchThrottle;
        private float touchBrake;
        private float touchSteering;
        private float touchHandbrake;
        private float lastTouchTime = -1f;

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
            bool touchIsActive = Time.unscaledTime - lastTouchTime < 0.15f;
            if (touchIsActive)
            {
                Throttle = Mathf.Clamp01(touchThrottle);
                Brake = Mathf.Clamp01(touchBrake);
                Steering = Mathf.Clamp(touchSteering, -1f, 1f);
                Handbrake = Mathf.Clamp01(touchHandbrake);
                return;
            }

            float axis = Input.GetAxisRaw("Vertical");
            float steeringAxis = Input.GetAxisRaw("Horizontal");
            float keyboardThrottle = Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow) ? 1f : 0f;
            float keyboardBrake = Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow) ? 1f : 0f;
            float keyboardSteering =
                (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) ? 1f : 0f) -
                (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) ? 1f : 0f);

            Throttle = Mathf.Clamp01(Mathf.Max(keyboardThrottle, axis));
            Brake = Mathf.Clamp01(Mathf.Max(keyboardBrake, -axis));
            Steering = Mathf.Abs(steeringAxis) > Mathf.Abs(keyboardSteering) ? steeringAxis : keyboardSteering;
            Handbrake = Input.GetKey(KeyCode.Space) ? 1f : 0f;
        }

        public void SetTouchInput(float throttle, float brake, float steering, float handbrake)
        {
            touchThrottle = throttle;
            touchBrake = brake;
            touchSteering = steering;
            touchHandbrake = handbrake;
            lastTouchTime = Time.unscaledTime;
        }

        public void SetExternalWheelInput(float throttle, float brake, float steering, float handbrake)
        {
            touchThrottle = throttle;
            touchBrake = brake;
            touchSteering = steering;
            touchHandbrake = handbrake;
            lastTouchTime = Time.unscaledTime;
        }
    }
}
