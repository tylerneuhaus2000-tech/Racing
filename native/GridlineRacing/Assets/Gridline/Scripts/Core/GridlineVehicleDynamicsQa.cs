using System;
using System.IO;
using UnityEngine;

namespace Gridline.Native
{
    // Deterministic vehicle tests for development builds. Each scenario still
    // drives the real Rigidbody through the normal input router.
    public sealed class GridlineVehicleDynamicsQa : MonoBehaviour
    {
        private enum Phase
        {
            Idle,
            SteeringEntry,
            SteeringStep,
            Acceleration,
            BrakeAcceleration,
            HighSpeedSteeringStep,
            Braking,
            Skidpad,
            ResetValidation,
            Complete
        }

        [Serializable]
        private sealed class Result
        {
            public string vehicle = "Ferrari 296 GT3";
            public string track = "GRIDLINE Vehicle Dynamics Facility";
            public string build = "native-rigidbody";
            public int targetFps;
            public float fixedStepHz;
            public bool passed;
            public float zeroTo50Kph;
            public float zeroTo100Kph;
            public float zeroTo200Kph;
            public float brakingDistanceFrom160Kph;
            public float peakLongitudinalG;
            public float peakLateralG;
            public float peakSlipRatio;
            public bool steeringStepCompleted;
            public float steeringStepInput;
            public float steeringStepStartSpeedKph;
            public float steeringStepEndSpeedKph;
            public float steeringStepMaxYawRate;
            public float steeringStepMaxSlipAngle;
            public float steeringStepPeakLateralG;
            public int steeringStepGroundingLossSamples;
            public bool steeringStepCollision;
            public bool highSpeedSteeringStepCompleted;
            public float highSpeedSteeringStepStartSpeedKph;
            public float highSpeedSteeringStepEndSpeedKph;
            public float highSpeedSteeringStepMaxYawRate;
            public float highSpeedSteeringStepMaxSlipAngle;
            public float highSpeedSteeringStepPeakLateralG;
            public int highSpeedSteeringStepGroundingLossSamples;
            public bool highSpeedSteeringStepCollision;
            public float minimumSuspensionLength;
            public float maximumSuspensionLength;
            public int groundingLossSamples;
            public bool resetClearedState;
            public int resetIterations;
            public int resetFailures;
            public string resultPath;
            public string snapshotPath;
        }

        private const int RequiredResetIterations = 10;

        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private GridlineInputRouter input;
        private Phase phase;
        private float phaseStartedAt;
        private float phaseElapsed;
        private float scenarioStartedAt;
        private float brakeStartPosition;
        private float peakLongitudinalG;
        private float peakLateralG;
        private float peakSlipRatio;
        private const float SteeringStepInput = 0.10f;
        private const float SteeringStepDuration = 4f;
        private const float HighSpeedSteeringStepDuration = 1.25f;
        private bool steeringStepCompleted;
        private float steeringStepStartSpeedKph;
        private float steeringStepEndSpeedKph;
        private float steeringStepMaxYawRate;
        private float steeringStepMaxSlipAngle;
        private float steeringStepPeakLateralG;
        private int steeringStepGroundingLossSamples;
        private bool steeringStepCollision;
        private bool highSpeedSteeringStepCompleted;
        private float highSpeedSteeringStepStartSpeedKph;
        private float highSpeedSteeringStepEndSpeedKph;
        private float highSpeedSteeringStepMaxYawRate;
        private float highSpeedSteeringStepMaxSlipAngle;
        private float highSpeedSteeringStepPeakLateralG;
        private int highSpeedSteeringStepGroundingLossSamples;
        private bool highSpeedSteeringStepCollision;
        private float minimumSuspensionLength = float.PositiveInfinity;
        private float maximumSuspensionLength;
        private int groundingLossSamples;
        private bool active;
        private bool initialized;
        private bool resetClearedState;
        private int resetIterations;
        private int resetFailures;
        private float nextResetAt;
        private float zeroTo50Kph = -1f;
        private float zeroTo100Kph = -1f;
        private float zeroTo200Kph = -1f;
        private float brakingDistanceFrom160Kph = -1f;

        public void Configure(GridlineVehicleController configuredVehicle, GridlineTrackData configuredTrack)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            input = GridlineInputRouter.Instance;
            active = HasArgument("-gridline-qa-vehicle");
        }

        private void Update()
        {
            if (!active || phase == Phase.Complete || vehicle == null || track == null) return;
            if (input == null) input = GridlineInputRouter.Instance;
            if (input == null) return;

            if (!initialized)
            {
                initialized = true;
                GridlineGameState.StartDriving();
                ResetToStart();
                phase = Phase.SteeringEntry;
                scenarioStartedAt = Time.unscaledTime;
                phaseStartedAt = scenarioStartedAt;
                phaseElapsed = 0f;
                Debug.Log("Gridline vehicle QA started: small-steer, acceleration, braking, skidpad, reset");
            }

            switch (phase)
            {
                case Phase.SteeringEntry:
                    input.SetExternalWheelInput(0.35f, 0f, 0f, 0f);
                    if (vehicle.SpeedKph >= 70f || ElapsedPhaseTime() > 12f)
                        BeginSteeringStep();
                    break;

                case Phase.SteeringStep:
                    // Controlled input probe only. This deliberately uses a
                    // small fixed steering command and does not alter vehicle
                    // forces, assists, or tire parameters.
                    input.SetExternalWheelInput(0.35f, 0f, SteeringStepInput, 0f);
                    if (ElapsedPhaseTime() > SteeringStepDuration)
                    {
                        steeringStepCompleted = true;
                        steeringStepEndSpeedKph = vehicle.SpeedKph;
                        Debug.Log($"Gridline vehicle QA steering-step steer={SteeringStepInput:0.00} "
                            + $"duration={SteeringStepDuration:0.0}s startSpeed={steeringStepStartSpeedKph:0.0}kph "
                            + $"endSpeed={steeringStepEndSpeedKph:0.0}kph "
                            + $"maxYaw={steeringStepMaxYawRate:0.000}rad/s "
                            + $"maxSlipAngle={steeringStepMaxSlipAngle:0.000}rad "
                            + $"peakLatG={steeringStepPeakLateralG:0.00} "
                            + $"groundingLossSamples={steeringStepGroundingLossSamples} "
                            + $"collision={steeringStepCollision}");
                        BeginAcceleration();
                    }
                    break;

                case Phase.Acceleration:
                    input.SetExternalWheelInput(1f, 0f, 0f, 0f);
                    if (vehicle.SpeedKph >= 50f && zeroTo50Kph < 0f) zeroTo50Kph = ElapsedPhaseTime();
                    if (vehicle.SpeedKph >= 100f && zeroTo100Kph < 0f) zeroTo100Kph = ElapsedPhaseTime();
                    if (vehicle.SpeedKph >= 200f && zeroTo200Kph < 0f)
                    {
                        zeroTo200Kph = ElapsedPhaseTime();
                        BeginBrakeAcceleration();
                    }
                    else if (ElapsedPhaseTime() > 18f)
                    {
                        BeginBrakeAcceleration();
                    }
                    break;

                case Phase.BrakeAcceleration:
                    input.SetExternalWheelInput(1f, 0f, 0f, 0f);
                    if (vehicle.SpeedKph >= 160f || ElapsedPhaseTime() > 14f)
                    {
                        if (!highSpeedSteeringStepCompleted)
                            BeginHighSpeedSteeringStep();
                        else
                            BeginBraking();
                    }
                    break;

                case Phase.HighSpeedSteeringStep:
                    input.SetExternalWheelInput(0.35f, 0f, SteeringStepInput, 0f);
                    if (ElapsedPhaseTime() > HighSpeedSteeringStepDuration)
                    {
                        highSpeedSteeringStepCompleted = true;
                        highSpeedSteeringStepEndSpeedKph = vehicle.SpeedKph;
                        Debug.Log($"Gridline vehicle QA high-speed-steering-step steer={SteeringStepInput:0.00} "
                            + $"duration={HighSpeedSteeringStepDuration:0.00}s "
                            + $"startSpeed={highSpeedSteeringStepStartSpeedKph:0.0}kph "
                            + $"endSpeed={highSpeedSteeringStepEndSpeedKph:0.0}kph "
                            + $"maxYaw={highSpeedSteeringStepMaxYawRate:0.000}rad/s "
                            + $"maxSlipAngle={highSpeedSteeringStepMaxSlipAngle:0.000}rad "
                            + $"peakLatG={highSpeedSteeringStepPeakLateralG:0.00} "
                            + $"groundingLossSamples={highSpeedSteeringStepGroundingLossSamples} "
                            + $"collision={highSpeedSteeringStepCollision}");
                        BeginBrakeAcceleration();
                    }
                    break;

                case Phase.Braking:
                    input.SetExternalWheelInput(0f, 1f, 0f, 0f);
                    if (vehicle.SpeedKph < 5f && ElapsedPhaseTime() > 0.5f)
                    {
                        brakingDistanceFrom160Kph = Mathf.Abs(vehicle.transform.position.x - brakeStartPosition);
                        BeginSkidpad();
                    }
                    break;

                case Phase.Skidpad:
                    // At the rightmost point of the 68 m circle, forward +Z
                    // and negative steering produce a left-hand constant radius.
                    input.SetExternalWheelInput(0.45f, 0f, -0.20f, 0f);
                    if (ElapsedPhaseTime() > 12f)
                    {
                        ResetToStart();
                        phase = Phase.ResetValidation;
                        phaseStartedAt = Time.unscaledTime;
                        phaseElapsed = 0f;
                        resetIterations = 0;
                        resetFailures = 0;
                        nextResetAt = 0f;
                    }
                    break;

                case Phase.ResetValidation:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    if (ElapsedPhaseTime() >= nextResetAt)
                    {
                        if (resetIterations > 0 && !IsResetStateClean()) resetFailures += 1;
                        if (resetIterations >= RequiredResetIterations)
                        {
                            resetClearedState = resetFailures == 0;
                            Complete();
                        }
                        else
                        {
                            ResetToStart();
                            resetIterations += 1;
                            // Give the physical suspension a few fixed steps to
                            // re-establish contact before judging the reset.
                            nextResetAt = ElapsedPhaseTime() + 1.20f;
                        }
                    }
                    break;
            }
        }

        private void FixedUpdate()
        {
            if (!active || !initialized || phase == Phase.Complete) return;
            phaseElapsed += Time.fixedDeltaTime;
            // Contact loss is a simulation sample, not a render-frame sample.
            // Recording it here keeps the result comparable at 30/60/120/144
            // FPS while the vehicle itself remains on the 120 Hz fixed clock.
            RecordTelemetry();
        }

        private void RecordTelemetry()
        {
            if (phase == Phase.ResetValidation) return;
            peakLongitudinalG = Mathf.Max(peakLongitudinalG, Mathf.Abs(vehicle.LongitudinalG));
            peakLateralG = Mathf.Max(peakLateralG, Mathf.Abs(vehicle.LateralG));
            peakSlipRatio = Mathf.Max(peakSlipRatio, vehicle.MaximumSlipRatio);
            minimumSuspensionLength = Mathf.Min(minimumSuspensionLength, vehicle.AverageSuspensionLength);
            maximumSuspensionLength = Mathf.Max(maximumSuspensionLength, vehicle.AverageSuspensionLength);
            // ResetForQa briefly leaves the body above the raycast range while
            // the suspension settles. Count contact loss only during actual
            // motion so extra diagnostic resets do not create a false QA fail.
            if (vehicle.SpeedKph > 10f && !vehicle.AllWheelsGrounded)
                groundingLossSamples += 1;

            if (phase == Phase.SteeringStep)
            {
                steeringStepMaxYawRate = Mathf.Max(steeringStepMaxYawRate, Mathf.Abs(vehicle.YawRate));
                steeringStepMaxSlipAngle = Mathf.Max(steeringStepMaxSlipAngle, vehicle.SlipAngle);
                steeringStepPeakLateralG = Mathf.Max(steeringStepPeakLateralG, Mathf.Abs(vehicle.LateralG));
                if (!vehicle.AllWheelsGrounded) steeringStepGroundingLossSamples += 1;
                if (vehicle.HasRecentCollision || vehicle.LastCollisionName != "none")
                    steeringStepCollision = true;
            }

            if (phase == Phase.HighSpeedSteeringStep)
            {
                highSpeedSteeringStepMaxYawRate = Mathf.Max(
                    highSpeedSteeringStepMaxYawRate, Mathf.Abs(vehicle.YawRate));
                highSpeedSteeringStepMaxSlipAngle = Mathf.Max(
                    highSpeedSteeringStepMaxSlipAngle, vehicle.SlipAngle);
                highSpeedSteeringStepPeakLateralG = Mathf.Max(
                    highSpeedSteeringStepPeakLateralG, Mathf.Abs(vehicle.LateralG));
                if (!vehicle.AllWheelsGrounded) highSpeedSteeringStepGroundingLossSamples += 1;
                if (vehicle.HasRecentCollision || vehicle.LastCollisionName != "none")
                    highSpeedSteeringStepCollision = true;
            }
        }

        private void BeginSteeringStep()
        {
            steeringStepStartSpeedKph = vehicle.SpeedKph;
            steeringStepEndSpeedKph = steeringStepStartSpeedKph;
            steeringStepMaxYawRate = 0f;
            steeringStepMaxSlipAngle = 0f;
            steeringStepPeakLateralG = 0f;
            steeringStepGroundingLossSamples = 0;
            steeringStepCollision = false;
            phase = Phase.SteeringStep;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
            Debug.Log($"Gridline vehicle QA steering-step started steer={SteeringStepInput:0.00} "
                + $"speed={steeringStepStartSpeedKph:0.0}kph duration={SteeringStepDuration:0.0}s");
        }

        private void BeginAcceleration()
        {
            ResetToStart();
            phase = Phase.Acceleration;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
        }

        private void BeginHighSpeedSteeringStep()
        {
            highSpeedSteeringStepStartSpeedKph = vehicle.SpeedKph;
            highSpeedSteeringStepEndSpeedKph = highSpeedSteeringStepStartSpeedKph;
            highSpeedSteeringStepMaxYawRate = 0f;
            highSpeedSteeringStepMaxSlipAngle = 0f;
            highSpeedSteeringStepPeakLateralG = 0f;
            highSpeedSteeringStepGroundingLossSamples = 0;
            highSpeedSteeringStepCollision = false;
            phase = Phase.HighSpeedSteeringStep;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
            Debug.Log($"Gridline vehicle QA high-speed-steering-step started steer={SteeringStepInput:0.00} "
                + $"speed={highSpeedSteeringStepStartSpeedKph:0.0}kph "
                + $"duration={HighSpeedSteeringStepDuration:0.00}s");
        }

        private void BeginBraking()
        {
            brakeStartPosition = vehicle.transform.position.x;
            phase = Phase.Braking;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
            Debug.Log($"Gridline vehicle QA braking started speed={vehicle.SpeedKph:0.0}kph");
        }

        private void BeginBrakeAcceleration()
        {
            ResetToStart();
            phase = Phase.BrakeAcceleration;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
        }

        private void BeginSkidpad()
        {
            Vector3 center = new Vector3(-125f, 0f, 55f);
            Vector3 position = center + Vector3.right * 68f + Vector3.up * 1.25f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(Vector3.forward, Vector3.up));
            phase = Phase.Skidpad;
            phaseStartedAt = Time.unscaledTime;
            phaseElapsed = 0f;
            Debug.Log("Gridline vehicle QA skidpad started radius=68m");
        }

        private void ResetToStart()
        {
            Vector3 position = track.Point(0) + Vector3.up * 1.25f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(track.Forward(0), Vector3.up));
        }

        private float ElapsedPhaseTime()
        {
            return phaseElapsed;
        }

        private void Complete()
        {
            phase = Phase.Complete;
            input.SetExternalWheelInput(0f, 0f, 0f, 0f);
            string directory = Path.Combine(Application.persistentDataPath, "Gridline", "QA");
            Directory.CreateDirectory(directory);
            string path = Path.Combine(directory, "vehicle-dynamics-latest.json");
            string snapshotPath = Path.Combine(directory,
                $"vehicle-dynamics-fps-{Application.targetFrameRate}.json");
            Result result = new Result
            {
                passed = zeroTo50Kph > 0f && zeroTo100Kph > 0f && brakingDistanceFrom160Kph > 0f
                    && steeringStepCompleted && !steeringStepCollision
                    && highSpeedSteeringStepCompleted && !highSpeedSteeringStepCollision
                    && resetClearedState && groundingLossSamples < 240,
                targetFps = Application.targetFrameRate,
                fixedStepHz = 1f / Mathf.Max(Time.fixedDeltaTime, 0.0001f),
                zeroTo50Kph = zeroTo50Kph,
                zeroTo100Kph = zeroTo100Kph,
                zeroTo200Kph = zeroTo200Kph,
                brakingDistanceFrom160Kph = brakingDistanceFrom160Kph,
                peakLongitudinalG = peakLongitudinalG,
                peakLateralG = peakLateralG,
                peakSlipRatio = peakSlipRatio,
                steeringStepCompleted = steeringStepCompleted,
                steeringStepInput = SteeringStepInput,
                steeringStepStartSpeedKph = steeringStepStartSpeedKph,
                steeringStepEndSpeedKph = steeringStepEndSpeedKph,
                steeringStepMaxYawRate = steeringStepMaxYawRate,
                steeringStepMaxSlipAngle = steeringStepMaxSlipAngle,
                steeringStepPeakLateralG = steeringStepPeakLateralG,
                steeringStepGroundingLossSamples = steeringStepGroundingLossSamples,
                steeringStepCollision = steeringStepCollision,
                highSpeedSteeringStepCompleted = highSpeedSteeringStepCompleted,
                highSpeedSteeringStepStartSpeedKph = highSpeedSteeringStepStartSpeedKph,
                highSpeedSteeringStepEndSpeedKph = highSpeedSteeringStepEndSpeedKph,
                highSpeedSteeringStepMaxYawRate = highSpeedSteeringStepMaxYawRate,
                highSpeedSteeringStepMaxSlipAngle = highSpeedSteeringStepMaxSlipAngle,
                highSpeedSteeringStepPeakLateralG = highSpeedSteeringStepPeakLateralG,
                highSpeedSteeringStepGroundingLossSamples = highSpeedSteeringStepGroundingLossSamples,
                highSpeedSteeringStepCollision = highSpeedSteeringStepCollision,
                minimumSuspensionLength = float.IsPositiveInfinity(minimumSuspensionLength)
                    ? 0f : minimumSuspensionLength,
                maximumSuspensionLength = maximumSuspensionLength,
                groundingLossSamples = groundingLossSamples,
                resetClearedState = resetClearedState,
                resetIterations = resetIterations,
                resetFailures = resetFailures,
                resultPath = path,
                snapshotPath = snapshotPath
            };
            string json = JsonUtility.ToJson(result, true);
            File.WriteAllText(path, json);
            File.WriteAllText(snapshotPath, json);
            Debug.Log($"Gridline vehicle QA {(result.passed ? "PASS" : "FAIL")}: "
                + $"0-100={result.zeroTo100Kph:0.000}s brake160={result.brakingDistanceFrom160Kph:0.0}m "
                + $"latG={result.peakLateralG:0.00} slip={result.peakSlipRatio:0.00} "
                + $"steerStep=yaw:{result.steeringStepMaxYawRate:0.000} "
                + $"slipAngle:{result.steeringStepMaxSlipAngle:0.000} "
                + $"latG:{result.steeringStepPeakLateralG:0.00} "
                + $"groundingLoss:{result.steeringStepGroundingLossSamples} "
                + $"collision:{result.steeringStepCollision} "
                + $"highSpeedSteer=yaw:{result.highSpeedSteeringStepMaxYawRate:0.000} "
                + $"slipAngle:{result.highSpeedSteeringStepMaxSlipAngle:0.000} "
                + $"latG:{result.highSpeedSteeringStepPeakLateralG:0.00} "
                + $"groundingLoss:{result.highSpeedSteeringStepGroundingLossSamples} "
                + $"collision:{result.highSpeedSteeringStepCollision} "
                + $"groundingLossSamples={result.groundingLossSamples} "
                + $"resets={result.resetIterations}/{result.resetFailures} result={path}");
            Application.Quit(result.passed ? 0 : 1);
        }

        private bool IsResetStateClean()
        {
            return vehicle.SpeedKph < 0.5f
                && Mathf.Abs(vehicle.YawRate) < 0.05f
                && vehicle.Gear == 1
                && vehicle.AllWheelsGrounded
                && vehicle.LastCollisionName == "none"
                && vehicle.AverageSuspensionLength >= 0f;
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
            {
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}
