using System;
using UnityEngine;

namespace Gridline.Native
{
    // Focused diagnostic for the current human-reported failures. It drives
    // the production Rigidbody and only records forces; it never changes
    // vehicle parameters or applies corrective forces.
    public sealed class GridlineTyreForceQa : MonoBehaviour
    {
        private enum Phase
        {
            Idle,
            ResetSettle,
            Interaction,
            Acceleration,
            BrakeAcceleration,
            Braking,
            Complete
        }

        private readonly float[] interactionSteers = { 0f, 0.08f, 0.20f, 0.45f };
        private readonly string[] interactionLabels = { "A", "B", "C", "D" };
        private readonly int[] brakeTargets = { 100, 160, 200 };
        private GridlineVehicleController vehicle;
        private GridlineTrackData track;
        private GridlineInputRouter input;
        private Phase phase;
        private int interactionIndex;
        private int brakeIndex;
        private float phaseElapsed;
        private float nextSampleAt;
        private float scenarioStartSpeed;
        private float scenarioStartDistance;
        private float scenarioPeakLongitudinalG;
        private float scenarioPeakYaw;
        private float scenarioPeakSlip;
        private Vector3 scenarioStartPosition;
        private Vector3 scenarioForward;
        private bool active;
        private bool initialized;
        private bool accelerationLogged;
        private float zeroTo50 = -1f;
        private float zeroTo100 = -1f;
        private float zeroTo200 = -1f;
        private float brakeStartSpeed;
        private float brakeStartTime;
        private float brakeStartDistance;
        private float brakePeakLongitudinalG;

        public void Configure(GridlineVehicleController configuredVehicle,
            GridlineTrackData configuredTrack)
        {
            vehicle = configuredVehicle;
            track = configuredTrack;
            input = GridlineInputRouter.Instance;
            active = HasArgument("-gridline-qa-tyre-interaction");
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
                BeginReset();
                Debug.Log("Gridline tyre QA started: full-throttle steer A/B/C/D, 0-50/100/200, brake 100/160/200");
            }

            switch (phase)
            {
                case Phase.ResetSettle:
                    input.SetExternalWheelInput(0f, 0f, 0f, 0f);
                    if (phaseElapsed >= 0.9f && vehicle.AllWheelsGrounded)
                    {
                        if (interactionIndex < interactionSteers.Length)
                            BeginInteraction();
                        else if (!accelerationLogged)
                            BeginAcceleration();
                        else if (brakeIndex < brakeTargets.Length)
                            BeginBrakeAcceleration();
                        else
                            Complete();
                    }
                    break;

                case Phase.Interaction:
                    input.SetExternalWheelInput(1f, 0f, interactionSteers[interactionIndex], 0f);
                    SampleScenario("interaction", interactionLabels[interactionIndex],
                        interactionSteers[interactionIndex]);
                    if (phaseElapsed >= 5f)
                    {
                        Debug.Log($"Gridline tyre QA interaction={interactionLabels[interactionIndex]} "
                            + $"steer={interactionSteers[interactionIndex]:0.00} duration={phaseElapsed:0.00}s "
                            + $"startSpeed={scenarioStartSpeed:0.0}kph endSpeed={vehicle.SpeedKph:0.0}kph "
                            + $"deltaSpeed={vehicle.SpeedKph - scenarioStartSpeed:0.0}kph "
                            + $"peakLongG={scenarioPeakLongitudinalG:0.00} "
                            + $"peakYaw={scenarioPeakYaw:0.000}rad/s peakSlip={scenarioPeakSlip:0.000} "
                            + $"engineFx={vehicle.EngineForceTelemetry:0} rearDriveFx={vehicle.RearDriveForceTelemetry:0} "
                            + $"rearFx={vehicle.RearLongitudinalForceTelemetry:0} "
                            + $"grounded={vehicle.GroundedWheelCount}/4");
                        interactionIndex += 1;
                        BeginReset();
                    }
                    break;

                case Phase.Acceleration:
                    input.SetExternalWheelInput(1f, 0f, 0f, 0f);
                    if (zeroTo50 < 0f && vehicle.SpeedKph >= 50f)
                        zeroTo50 = phaseElapsed;
                    if (zeroTo100 < 0f && vehicle.SpeedKph >= 100f)
                        zeroTo100 = phaseElapsed;
                    if (zeroTo200 < 0f && vehicle.SpeedKph >= 200f)
                        zeroTo200 = phaseElapsed;
                    if (!accelerationLogged && (zeroTo200 > 0f || phaseElapsed >= 24f))
                    {
                        accelerationLogged = true;
                        Debug.Log($"Gridline tyre QA acceleration 0-50={FormatTime(zeroTo50)}s "
                            + $"0-100={FormatTime(zeroTo100)}s 0-200={FormatTime(zeroTo200)}s");
                        BeginReset();
                    }
                    break;

                case Phase.BrakeAcceleration:
                    input.SetExternalWheelInput(1f, 0f, 0f, 0f);
                    if (vehicle.SpeedKph >= brakeTargets[brakeIndex])
                    {
                        brakeStartSpeed = vehicle.SpeedKph;
                        brakeStartTime = Time.fixedTime;
                        brakeStartDistance = DistanceAlongScenario();
                        brakePeakLongitudinalG = 0f;
                        phase = Phase.Braking;
                        phaseElapsed = 0f;
                        Debug.Log($"Gridline tyre QA braking started target={brakeTargets[brakeIndex]}kph "
                            + $"speed={brakeStartSpeed:0.0}kph");
                    }
                    else if (phaseElapsed >= 26f)
                    {
                        LogBrakeResult("timeout");
                        brakeIndex += 1;
                        BeginReset();
                    }
                    break;

                case Phase.Braking:
                    input.SetExternalWheelInput(0f, 1f, 0f, 0f);
                    // Ignore the final stop-frame velocity discontinuity. It
                    // is a measurement artifact at near-zero speed, not a
                    // physical braking peak.
                    if (vehicle.SpeedKph > 5f)
                    {
                        brakePeakLongitudinalG = Mathf.Max(brakePeakLongitudinalG,
                            Mathf.Max(0f, -vehicle.MeasuredLongitudinalG));
                    }
                    if (vehicle.SpeedKph <= 1.5f && phaseElapsed >= 0.25f)
                    {
                        LogBrakeResult("complete");
                        brakeIndex += 1;
                        BeginReset();
                    }
                    else if (phaseElapsed >= 12f)
                    {
                        LogBrakeResult("timeout");
                        brakeIndex += 1;
                        BeginReset();
                    }
                    break;
            }
        }

        private void BeginReset()
        {
            Vector3 position = track.Point(0) + Vector3.up * 0.45f;
            vehicle.ResetForQa(position, Quaternion.LookRotation(track.Forward(0), Vector3.up));
            phase = Phase.ResetSettle;
            phaseElapsed = 0f;
            nextSampleAt = 0f;
        }

        private void FixedUpdate()
        {
            if (!active || !initialized || phase == Phase.Complete) return;
            phaseElapsed += Time.fixedDeltaTime;
        }

        private void BeginInteraction()
        {
            phase = Phase.Interaction;
            phaseElapsed = 0f;
            scenarioStartSpeed = vehicle.SpeedKph;
            scenarioStartPosition = vehicle.transform.position;
            scenarioForward = vehicle.transform.forward;
            scenarioPeakLongitudinalG = 0f;
            scenarioPeakYaw = 0f;
            scenarioPeakSlip = 0f;
            nextSampleAt = 0f;
            Debug.Log($"Gridline tyre QA interaction={interactionLabels[interactionIndex]} started "
                + $"steer={interactionSteers[interactionIndex]:0.00}");
        }

        private void BeginBrakeAcceleration()
        {
            phase = Phase.BrakeAcceleration;
            phaseElapsed = 0f;
            scenarioStartPosition = vehicle.transform.position;
            scenarioForward = vehicle.transform.forward;
        }

        private void BeginAcceleration()
        {
            phase = Phase.Acceleration;
            phaseElapsed = 0f;
            zeroTo50 = -1f;
            zeroTo100 = -1f;
            zeroTo200 = -1f;
            scenarioStartPosition = vehicle.transform.position;
            scenarioForward = vehicle.transform.forward;
        }

        private void SampleScenario(string kind, string label, float steering)
        {
            scenarioPeakLongitudinalG = Mathf.Max(scenarioPeakLongitudinalG,
                Mathf.Abs(vehicle.LongitudinalG));
            scenarioPeakYaw = Mathf.Max(scenarioPeakYaw, Mathf.Abs(vehicle.YawRate));
            scenarioPeakSlip = Mathf.Max(scenarioPeakSlip, vehicle.MaximumSlipRatio);
            if (phaseElapsed < nextSampleAt) return;
            // Keep the force snapshot readable without making diagnostic I/O
            // the dominant load in the fixed-step simulation.
            nextSampleAt = phaseElapsed + 1f;
            Debug.Log($"Gridline tyre QA sample kind={kind} scenario={label} "
                + $"t={phaseElapsed:0.00}s throttle={vehicle.ThrottleInput:0.00} "
                + $"steer={steering:0.00} speed={vehicle.SpeedKph:0.0}kph gear={vehicle.GearLabel} "
                + $"rpm={vehicle.Rpm:0} engineFx={vehicle.EngineForceTelemetry:0} "
                + $"rearDriveFx={vehicle.RearDriveForceTelemetry:0} rearFx={vehicle.RearLongitudinalForceTelemetry:0} "
                + $"longG={vehicle.LongitudinalG:0.00} latG={vehicle.LateralG:0.00} "
                + $"yaw={vehicle.YawRate:0.000} slip={vehicle.MaximumSlipRatio:0.000} "
                + $"grounded={vehicle.GroundedWheelCount}/4 {vehicle.WheelForceTelemetry}");
        }

        private void LogBrakeResult(string result)
        {
            float distance = Mathf.Max(0f, DistanceAlongScenario() - brakeStartDistance);
            float elapsed = Mathf.Max(0f, Time.fixedTime - brakeStartTime);
            Debug.Log($"Gridline tyre QA braking target={brakeTargets[brakeIndex]}kph result={result} "
                + $"startSpeed={brakeStartSpeed:0.0}kph distance={distance:0.0}m "
                + $"time={elapsed:0.000}s peakLongG={brakePeakLongitudinalG:0.00} "
                + $"grounded={vehicle.GroundedWheelCount}/4 {vehicle.WheelForceTelemetry}");
        }

        private float DistanceAlongScenario()
        {
            return Vector3.Dot(vehicle.transform.position - scenarioStartPosition, scenarioForward);
        }

        private void Complete()
        {
            phase = Phase.Complete;
            input.SetExternalWheelInput(0f, 0f, 0f, 0f);
            Debug.Log($"Gridline tyre QA PASS acceleration=0-50:{FormatTime(zeroTo50)}s "
                + $"0-100:{FormatTime(zeroTo100)}s 0-200:{FormatTime(zeroTo200)}s");
            Application.Quit(0);
        }

        private static string FormatTime(float value)
        {
            return value >= 0f ? value.ToString("0.000") : "UNAVAILABLE";
        }

        private static bool HasArgument(string expected)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
                if (args[i].Equals(expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }
    }
}
