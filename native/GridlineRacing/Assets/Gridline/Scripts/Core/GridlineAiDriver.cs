using UnityEngine;

namespace Gridline.Native
{
    // Native race AI uses the same Rigidbody, suspension and tyre forces as the
    // player. It only supplies per-car controls and never edits vehicle state.
    public sealed class GridlineAiDriver : MonoBehaviour
    {
        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private GridlineRaceSession race;
        private string driverName;
        private float pace;
        private float lastProgress;
        private bool progressReady;
        private float offTrackTime;
        private bool offTrackLogged;
        private float nextLog;

        public int CompletedLaps { get; private set; }
        public float RaceProgress { get; private set; }
        public string DriverName => driverName;
        public int ContactLossEvents { get; private set; }
        public int RecoveryResetCount { get; private set; }

        public void Configure(GridlineVehicleController configuredVehicle,
            GridlineTrackData configuredTrack, GridlineRaceSession configuredRace,
            string configuredName, float configuredPace)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            race = configuredRace;
            driverName = configuredName;
            pace = configuredPace;
            lastProgress = 0f;
            progressReady = false;
            offTrackTime = 0f;
            offTrackLogged = false;
            nextLog = 0f;
            ContactLossEvents = 0;
            RecoveryResetCount = 0;
        }

        private void Update()
        {
            if (vehicle == null || track == null || race == null || !race.Enabled) return;
            if (!race.IsRaceLive)
            {
                vehicle.SetDriverInput(0f, 0.2f, 0f, 0f);
                return;
            }

            GridlineTrackData.Sample sample = track.Query(vehicle.transform.position,
                vehicle.TrackSampleIndex);
            float speed = vehicle.SpeedKph / 3.6f;
            UpdateProgress(sample.progress);
            bool driverLeftTrack = !sample.onTrack
                || Mathf.Abs(sample.lateral) > track.halfWidth + 1.5f;
            if (!vehicle.AllWheelsGrounded || driverLeftTrack)
            {
                offTrackTime += Time.unscaledDeltaTime;
                if (!offTrackLogged)
                {
                    offTrackLogged = true;
                    if (!vehicle.AllWheelsGrounded) ContactLossEvents += 1;
                    string reason = driverLeftTrack ? "off_track" : "ground_contact_loss";
                    Debug.Log($"Gridline race AI event class=AI_DRIVER reason={reason} "
                        + $"driver={driverName} progress={RaceProgress:0.000} "
                        + $"lateral={sample.lateral:0.0} surface={sample.surface} "
                        + $"grounded={vehicle.AllWheelsGrounded} groundedWheels={vehicle.GroundedWheelCount}/4");
                }
                float recoverySteer = Mathf.Clamp(
                    -sample.lateral / Mathf.Max(track.halfWidth, 1f), -0.45f, 0.45f);
                vehicle.SetDriverInput(0f, speed > 7f ? 0.8f : 0f, recoverySteer, 0f);
                if (offTrackTime > 2.5f)
                {
                    RecoveryResetCount += 1;
                    Debug.Log($"Gridline race AI event class=AI_DRIVER reason=reset "
                        + $"driver={driverName} progress={RaceProgress:0.000}");
                    vehicle.ResetCar();
                    offTrackTime = 0f;
                    offTrackLogged = false;
                    CompletedLaps = 0;
                    RaceProgress = 0f;
                    lastProgress = 0f;
                    progressReady = false;
                }
                return;
            }
            offTrackTime = 0f;
            offTrackLogged = false;

            int lookAheadSamples = Mathf.Clamp(Mathf.RoundToInt(8f + speed * 0.42f), 10, 30);
            Vector3 target = track.Point(sample.index + lookAheadSamples);
            Vector3 targetDirection = target - vehicle.transform.position;
            targetDirection.y = 0f;
            if (targetDirection.sqrMagnitude < 0.01f) targetDirection = sample.forward;
            float headingError = Vector3.SignedAngle(vehicle.transform.forward,
                targetDirection.normalized, Vector3.up);
            if (Mathf.Abs(headingError) > 110f)
            {
                targetDirection = sample.forward;
                targetDirection.y = 0f;
                headingError = Vector3.SignedAngle(vehicle.transform.forward,
                    targetDirection.normalized, Vector3.up);
            }
            float lateralCorrection = -sample.lateral / Mathf.Max(track.halfWidth, 1f) * 0.85f;
            float steering = Mathf.Clamp(headingError / 27f + lateralCorrection, -1f, 1f);

            float nearCurve = Vector3.Angle(track.Forward(sample.index - 8),
                track.Forward(sample.index + 8));
            float upcomingCurve = Vector3.Angle(track.Forward(sample.index + lookAheadSamples),
                track.Forward(sample.index + lookAheadSamples * 3));
            float scannedCurve = ScanUpcomingCurve(sample.index, lookAheadSamples);
            float curve = Mathf.Max(nearCurve, upcomingCurve, scannedCurve);
            float targetSpeed = Mathf.Clamp(43f - curve * 0.50f, 10f, 43f);
            if (curve > 8f) targetSpeed = Mathf.Min(targetSpeed, 26f);
            if (curve > 16f) targetSpeed = Mathf.Min(targetSpeed, 20f);
            if (curve > 25f) targetSpeed = Mathf.Min(targetSpeed, 16f);
            if (Mathf.Abs(sample.lateral) > track.halfWidth * 0.20f)
                targetSpeed = Mathf.Min(targetSpeed, 18f);
            if (Mathf.Abs(sample.lateral) > track.halfWidth * 0.35f)
                targetSpeed = Mathf.Min(targetSpeed, 13f);
            targetSpeed *= pace;

            float brakeDistance = Mathf.Max(10f,
                speed * speed / Mathf.Max(targetSpeed * 2.0f, 1f));
            float throttle = speed < targetSpeed - 1.5f ? 1f
                : speed < targetSpeed + 0.5f ? 0.25f : 0f;
            float brake = speed > targetSpeed + 2.0f
                ? Mathf.Clamp01((speed - targetSpeed) / Mathf.Max(4f, brakeDistance * 0.16f))
                : 0f;
            if (Mathf.Abs(headingError) > 55f)
            {
                throttle = speed < 7f ? 0.18f : 0f;
                brake = speed < 6f ? 0f : 1f;
                float recoverySteer = speed < 14f
                    ? lateralCorrection
                    : headingError / 180f + lateralCorrection * 0.65f;
                steering = Mathf.Clamp(recoverySteer, -0.34f, 0.34f);
            }

            vehicle.SetDriverInput(throttle, brake, steering, 0f);
            if (Time.unscaledTime >= nextLog)
            {
                nextLog = Time.unscaledTime + 5f;
                Debug.Log($"Gridline race AI progress driver={driverName} "
                    + $"lap={CompletedLaps + 1} progress={sample.progress * 100f:0.0}% "
                    + $"speed={vehicle.SpeedKph:0.0} grounded={vehicle.AllWheelsGrounded}");
            }
        }

        private void UpdateProgress(float progress)
        {
            if (!progressReady)
            {
                lastProgress = progress;
                progressReady = true;
            }
            else
            {
                if (lastProgress > 0.90f && progress < 0.10f)
                {
                    CompletedLaps += 1;
                    Debug.Log($"Gridline race AI lap driver={driverName} lap={CompletedLaps}");
                }
                lastProgress = progress;
            }
            RaceProgress = CompletedLaps + progress;
        }

        private float ScanUpcomingCurve(int index, int horizon)
        {
            float maximum = 0f;
            for (int offset = 4; offset <= horizon * 4; offset += 4)
            {
                float local = Vector3.Angle(track.Forward(index + offset - 6),
                    track.Forward(index + offset + 6));
                maximum = Mathf.Max(maximum, local);
            }
            return maximum;
        }
    }
}
