using UnityEngine;

namespace Gridline.Native
{
    public sealed class GridlineCameraRig : MonoBehaviour
    {
        public Transform Target;

        [SerializeField] private Vector3 localOffset = new Vector3(0f, 3.55f, -7.15f);
        [SerializeField] private float positionSmooth = 0.055f;
        [SerializeField] private float lookAhead = 10.5f;

        private Vector3 velocity;

        private void LateUpdate()
        {
            if (Target == null)
            {
                return;
            }

            Vector3 desiredPosition = Target.position + Target.TransformDirection(localOffset);
            transform.position = Vector3.SmoothDamp(transform.position, desiredPosition, ref velocity, positionSmooth);

            Vector3 lookPoint = Target.position + Vector3.up * 1.15f + Target.forward * lookAhead;
            Quaternion desiredRotation = Quaternion.LookRotation(lookPoint - transform.position, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, Time.deltaTime * 10f);
        }
    }
}
