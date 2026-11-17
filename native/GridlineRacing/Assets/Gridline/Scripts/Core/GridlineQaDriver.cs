using UnityEngine;

namespace Gridline.Native
{
    // Deterministic development driver. It never runs in a normal build unless
    // -gridline-qa-lap is supplied, and it still drives through the real input
    // router and Rigidbody vehicle rather than teleporting the car.
    public sealed class GridlineQaDriver : MonoBehaviour
    {
        private const int RequiredValidatedLaps = 2;
        private const float QaMaxSpeed = 72f;
        private const float QaLateralAcceleration = 1.30f * 9.81f;
        private const float QaCornerSafety = 0.86f;
        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private GridlineLapSystem laps;
        private GridlineInputRouter input;
        private float stuckTime;
        private float nextLog;
        private int recoveryAttempts;
        private bool active;
        private bool timeTrialQa;
        private bool raceQa;
        private bool completed;
        private bool failureLoggedForCurrentLap;
        private int observedCompletedLaps;
        private float settleTime;
        private bool startFailureLogged;
        private float previousProgress;
        private float progressStallTime;
        private bool progressInitialized;

        // Driver recovery timers measure active simulation time. Do not count
        // a large host wake-up delta as a real stall or stuck interval.
        private static float SimulationDeltaTime => Mathf.Clamp(
            Time.unscaledDeltaTime, 0f, 0.25f);

        public void Configure(GridlineVehicleController configuredVehicle,
            GridlineTrackData configuredTrack, GridlineLapSystem configuredLaps)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            laps = configuredLaps;
            input = GridlineInputRouter.Instance;
            timeTrialQa = HasArgument("-gridline-qa-time-trial");
            raceQa = HasArgument("-gridline-qa-race");
            active = HasArgument("-gridline-qa-lap") || timeTrialQa
                || raceQa
                || HasArgument("-gridline-qa-time-trial-restart");
            observedCompletedLaps = laps != null ? laps.CompletedLaps : 0;
            progressInitialized = false;
            progressStallTime = 0f;
        }

        private void Update()
        {
            if (!active || completed || vehicle == null || track == null) return;
            if (input == null) input = GridlineInputRouter.Instance;
            if (input == null) return;

            if (!HasArgument("-gridline-testpad") && !GridlineTrackCollision.IsBuilt)
            {
                // Do not start the physical driver while the asynchronous GLB
                // collision build is still pending.
                input.SetExternalWheelInput(0f, 1f, 0f, 0f);
                return;
            }

            if (GridlineGameState.IsMenu) GridlineGameState.StartDriving();
            if (!vehicle.AllWheelsGrounded)
            {
                settleTime += SimulationDeltaTime;
                input.SetExternalWheelInput(0f, 1f, 0f, 0f);
                if (settleTime > 2f && !startFailureLogged)
                {
                    startFailureLogged = true;
                    bool driverLeftTrack = !vehicle.OnTrack
                        || Mathf.Abs(vehicle.TrackLateral) > track.halfWidth + 1.5f;
                    string failureClass = driverLeftTrack ? "QA_DRIVER" : "VEHICLE_PHYSICS";
                    string reason = driverLeftTrack ? "off_track_no_contact" : "start_not_grounded";
                    Debug.Log($"Gridline QA failure class={failureClass} reason={reason} "
                        + $"progress={vehicle.TrackProgress * 100f:0.0}% pos={vehicle.transform.position} "
                        + $"surface={vehicle.SurfaceLabel} collision={vehicle.LastCollisionName}");
                }
                if (settleTime > 2.5f)
                {
                    vehicle.ResetCar();
                    settleTime = 0f;
                    startFailureLogged = false;
                }
                return;
            }
            settleTime = 0f;
            startFailureLogged = false;
            if (laps != null && laps.CompletedLaps != observedCompletedLaps)
            {
                observedCompletedLaps = laps.CompletedLaps;
                failureLoggedForCurrentLap = false;
            }
            GridlineTrackData.Sample sample = track.Query(vehicle.transform.position, vehicle.TrackSampleIndex);
            TrackProgressWatch(sample.progress);
            float speed = vehicle.SpeedKph / 3.6f;
            int lookAheadSamples = Mathf.Clamp(Mathf.RoundToInt(8f + speed * 0.42f), 10, 30);
            Vector3 lookAhead = track.Point(sample.index + lookAheadSamples);
            Vector3 targetDirection = lookAhead - vehicle.transform.position;
            targetDirection.y = 0f;
            if (targetDirection.sqrMagnitude < 0.01f) targetDirection = sample.forward;

            // Pure pursuit keeps the physical driver aimed through the corner
            // rather than reacting only after its chassis has reached it.
            float headingError = Vector3.SignedAngle(vehicle.transform.forward, targetDirection.normalized, Vector3.up);
            if (Mathf.Abs(headingError) > 110f)
            {
                // Once the far look-ahead point is behind the car, follow the
                // local track tangent while recovering. This is QA-driver
                // guidance only; the vehicle model and grip remain untouched.
                targetDirection = sample.forward;
                targetDirection.y = 0f;
                headingError = Vector3.SignedAngle(vehicle.transform.forward,
                    targetDirection.normalized, Vector3.up);
            }
            float lateralCorrection = -sample.lateral / Mathf.Max(track.halfWidth, 1f) * 0.85f;
            float steering = Mathf.Clamp(headingError / 27f + lateralCorrection, -1f, 1f);

            float nearCurve = Vector3.Angle(track.Forward(sample.index - 8), track.Forward(sample.index + 8));
            float upcomingCurve = Vector3.Angle(track.Forward(sample.index + lookAheadSamples),
                track.Forward(sample.index + lookAheadSamples * 3));
            float scannedCurve = ScanUpcomingCurve(track, sample.index, lookAheadSamples * 4);
            float curveDegrees = Mathf.Max(nearCurve, upcomingCurve, scannedCurve);
            // The old driver used fixed 58/72/94 km/h corner caps. That made
            // successful laps a weak test of the car's real operating window.
            // Estimate a local radius from the measured tangent change and a
            // fixed 36 m curvature window, then apply a modest margin to a
            // physical lateral-acceleration limit. This changes only QA input.
            float curveRadians = curveDegrees * Mathf.Deg2Rad;
            float radius = curveRadians > 0.035f ? 36f / curveRadians : 10000f;
            float cornerSpeed = Mathf.Sqrt(QaLateralAcceleration * radius) * QaCornerSafety;
            float targetSpeed = Mathf.Clamp(cornerSpeed, 16f, QaMaxSpeed);
            if (Mathf.Abs(sample.lateral) > track.halfWidth * 0.20f)
                targetSpeed *= 0.92f;
            if (Mathf.Abs(sample.lateral) > track.halfWidth * 0.35f)
                targetSpeed *= 0.82f;
            float speedDeltaSquared = speed * speed - targetSpeed * targetSpeed;
            float brakeDistance = Mathf.Max(10f,
                speedDeltaSquared > 0f ? speedDeltaSquared / (2f * 12f) : 10f);
            float throttle = speed < targetSpeed - 1.5f ? 1f : speed < targetSpeed + 0.5f ? 0.25f : 0f;
            float brake = speed > targetSpeed + 2.0f
                ? Mathf.Clamp01((speed - targetSpeed) / Mathf.Max(4f, brakeDistance * 0.16f))
                : 0f;
            if (Mathf.Abs(headingError) > 55f)
            {
                // Do not hold the service brake at walking pace: the real
                // vehicle input layer correctly interprets that combination
                // as a request to select reverse. Let the QA driver roll out
                // of a tight corner instead of applying full lock while the
                // look-ahead point is already off the car's current heading.
                throttle = speed < 6f ? 0.22f : 0f;
                brake = speed < 6f ? 0f : 1f;
                // Keep recovery inside the track instead of holding a fixed
                // steering sign. At low speed the lateral error is the most
                // reliable signal; at speed, blend it with the local tangent
                // so the QA driver does not amplify a missed apex.
                float recoverySteer = speed < 14f
                    ? lateralCorrection
                    : headingError / 180f + lateralCorrection * 0.65f;
                recoverySteer = Mathf.Clamp(recoverySteer, -0.34f, 0.34f);
                steering = recoverySteer;
            }

            // A missed look-ahead target can leave the QA driver crawling while
            // still physically grounded and inside the track. That is a driver
            // failure, not a reason to alter grip or suspension. For a short
            // low-speed recovery, steer toward the local track tangent and use
            // throttle only so service braking cannot select reverse.
            if (progressStallTime > 1.5f && speed < 8f)
            {
                Vector3 tangent = sample.forward;
                tangent.y = 0f;
                float tangentError = Vector3.SignedAngle(
                    vehicle.transform.forward, tangent.normalized, Vector3.up);
                steering = Mathf.Clamp(
                    tangentError / 45f
                    - sample.lateral / Mathf.Max(track.halfWidth, 1f) * 0.40f,
                    -0.45f,
                    0.45f);
                throttle = 1f;
                brake = 0f;
            }

            if (speed < 1f) stuckTime += SimulationDeltaTime;
            else stuckTime = 0f;

            if (laps != null && !laps.IsValidLap && !failureLoggedForCurrentLap)
            {
                LogLapFailure(sample, speed, targetSpeed, headingError);
                failureLoggedForCurrentLap = true;
            }

            if (stuckTime > 4f)
            {
                // The normal reset is part of vehicle simulation and clears
                // wheel, drivetrain and lap state. It is preferable to
                // repeatedly holding reverse against a barrier during QA.
                recoveryAttempts += 1;
                Debug.Log($"Gridline QA failure class=RESET reason=stuck recovery={recoveryAttempts} "
                    + $"progress={sample.progress * 100f:0.0}% speed={vehicle.SpeedKph:0.0} "
                    + $"lateral={sample.lateral:0.0}");
                vehicle.ResetCar();
                failureLoggedForCurrentLap = false;
                stuckTime = 0f;
                progressInitialized = false;
                progressStallTime = 0f;
                return;
            }

            if (progressStallTime > 6f)
            {
                recoveryAttempts += 1;
                Debug.Log($"Gridline QA failure class=QA_DRIVER reason=progress_stall recovery={recoveryAttempts} "
                    + $"progress={sample.progress * 100f:0.0}% speed={vehicle.SpeedKph:0.0} "
                    + $"lateral={sample.lateral:0.0} heading={headingError:0.0} "
                    + $"target={targetSpeed * 3.6f:0.0} throttle={throttle:0.00} "
                    + $"brake={brake:0.00} steer={steering:0.00} "
                    + $"grounded={vehicle.AllWheelsGrounded} surface={vehicle.SurfaceLabel} "
                    + $"collision={vehicle.LastCollisionName}");
                if (recoveryAttempts >= 3)
                {
                    Debug.Log("Gridline QA failure class=QA_DRIVER reason=progress_stall_repeated");
                    Application.Quit(1);
                    return;
                }
                vehicle.ResetCar();
                failureLoggedForCurrentLap = false;
                stuckTime = 0f;
                progressInitialized = false;
                progressStallTime = 0f;
                return;
            }

            input.SetExternalWheelInput(throttle, brake, steering, 0f);
            if (Time.unscaledTime >= nextLog)
            {
                nextLog = Time.unscaledTime + 5f;
                Debug.Log($"Gridline QA lap progress={sample.progress * 100f:0.0}% speed={vehicle.SpeedKph:0.0} "
                    + $"target={targetSpeed * 3.6f:0} lateral={sample.lateral:0.0} valid={laps?.IsValidLap}");
            }

            int requiredLaps = timeTrialQa ? 1 : RequiredValidatedLaps;
            if (!raceQa && laps != null && laps.ValidCompletedLaps >= requiredLaps)
            {
                completed = true;
                input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                Debug.Log($"Gridline QA lap completed: time={laps.LastLapTime:0.000}s "
                    + $"valid={laps.LastLapWasValid} validCount={laps.ValidCompletedLaps} "
                    + $"invalidCount={laps.InvalidCompletedLaps} collisions={vehicle.name}");
                Application.Quit(0);
            }
        }

        private void LogLapFailure(GridlineTrackData.Sample sample, float speed,
            float targetSpeed, float headingError)
        {
            FailureClass failureClass = ClassifyFailure(sample, speed, headingError);
            string rule = laps != null ? laps.InvalidReason : string.Empty;
            Debug.Log($"Gridline QA lap failure class={failureClass} rule={rule} "
                + $"progress={sample.progress * 100f:0.0}% speed={speed * 3.6f:0.0} "
                + $"target={targetSpeed * 3.6f:0.0} lateral={sample.lateral:0.0} "
                + $"heading={headingError:0.0} yaw={vehicle.YawRate:0.00} "
                + $"slip={vehicle.SlipAngle:0.00} maxSlip={vehicle.MaximumSlipRatio:0.00} "
                + $"grounded={vehicle.AllWheelsGrounded} surface={vehicle.SurfaceLabel} "
                + $"collision={vehicle.LastCollisionName} impulse={vehicle.LastCollisionImpulse:0.0} "
                + $"input=thr:{vehicle.ThrottleInput:0.00},brk:{vehicle.BrakeInput:0.00},steer:{vehicle.SteerInput:0.00}");
        }

        private void TrackProgressWatch(float progress)
        {
            if (!progressInitialized)
            {
                previousProgress = progress;
                progressInitialized = true;
                progressStallTime = 0f;
                return;
            }

            float advance = progress - previousProgress;
            if (advance < -0.5f) advance += 1f;
            if (advance > 0.00005f)
            {
                previousProgress = progress;
                progressStallTime = 0f;
            }
            else
            {
                progressStallTime += SimulationDeltaTime;
            }
        }

        private FailureClass ClassifyFailure(GridlineTrackData.Sample sample,
            float speed, float headingError)
        {
            if (vehicle == null || track == null || laps == null) return FailureClass.UNKNOWN;
            if (vehicle.HasRecentCollision && IsBarrierName(vehicle.LastCollisionName))
                return FailureClass.TRACK_COLLISION;
            if (!IsFinite(vehicle.transform.position) || vehicle.Body == null
                || !IsFinite(vehicle.Body.linearVelocity) || !IsFinite(vehicle.YawRate)
                || !IsFinite(vehicle.SlipAngle))
                return FailureClass.VEHICLE_PHYSICS;
            if (speed > 8f && (!vehicle.AllWheelsGrounded || Mathf.Abs(vehicle.YawRate) > 2.8f))
                return FailureClass.VEHICLE_PHYSICS;
            if (laps.InvalidReason == "track_limits" && !sample.onTrack
                && vehicle.AllWheelsGrounded && !vehicle.HasRecentCollision
                && Mathf.Abs(vehicle.YawRate) < 2.8f)
                return FailureClass.QA_DRIVER;
            if (laps.InvalidReason == "wrong_way") return FailureClass.QA_DRIVER;
            if (sample.surface == GridlineSurface.Track && vehicle.SurfaceLabel == "GRASS"
                && Mathf.Abs(sample.lateral) <= track.halfWidth + 0.25f)
                return FailureClass.SURFACE_DETECTION;
            if (input == null) return FailureClass.INPUT;
            if (Mathf.Abs(headingError) > 110f || speed < 0.1f) return FailureClass.QA_DRIVER;
            return FailureClass.LAP_VALIDATION;
        }

        private static bool IsBarrierName(string name)
        {
            string lower = (name ?? string.Empty).ToLowerInvariant();
            return lower.Contains("barrier") || lower.Contains("wall")
                || lower.Contains("fence") || lower.Contains("guard");
        }

        private static bool IsFinite(Vector3 value)
        {
            return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private enum FailureClass
        {
            VEHICLE_PHYSICS,
            TRACK_COLLISION,
            SURFACE_DETECTION,
            LAP_VALIDATION,
            QA_DRIVER,
            INPUT,
            RESET,
            UNKNOWN
        }

        private static float ScanUpcomingCurve(GridlineTrackData source, int index, int horizon)
        {
            float maximum = 0f;
            for (int offset = 4; offset <= horizon; offset += 4)
            {
                float localCurve = Vector3.Angle(
                    source.Forward(index + offset - 6),
                    source.Forward(index + offset + 6));
                maximum = Mathf.Max(maximum, localCurve);
            }
            return maximum;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, System.StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
