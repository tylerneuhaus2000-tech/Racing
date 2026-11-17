Shader "Gridline/GLB Lit Color"
{
    Properties
    {
        [MainTexture] _MainTex ("Base Color", 2D) = "white" {}
        [MainColor] _Color ("Fallback Color", Color) = (1,1,1,1)
        _TextureMix ("Texture Mix", Range(0,1)) = 1
        _Glossiness ("Glossiness", Range(0,1)) = 0.28
        _SpecularStrength ("Specular Strength", Range(0,1)) = 0.18
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 200
        Cull Off
        ZWrite On

        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase
            #pragma target 3.0
            #include "UnityCG.cginc"
            #include "Lighting.cginc"

            fixed4 _Color;
            float _TextureMix;
            float _Glossiness;
            float _SpecularStrength;
            sampler2D _MainTex;
            float4 _MainTex_ST;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
                float3 worldPosition : TEXCOORD2;
                UNITY_FOG_COORDS(3)
            };

            v2f vert(appdata input)
            {
                v2f output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.uv = TRANSFORM_TEX(input.uv, _MainTex);
                output.worldNormal = UnityObjectToWorldNormal(input.normal);
                output.worldPosition = mul(unity_ObjectToWorld, input.vertex).xyz;
                UNITY_TRANSFER_FOG(output, output.vertex);
                return output;
            }

            fixed4 frag(v2f input) : SV_Target
            {
                fixed4 textureColor = tex2D(_MainTex, input.uv);
                fixed3 albedo = lerp(_Color.rgb, textureColor.rgb * 1.05, _TextureMix);
                fixed3 normal = normalize(input.worldNormal);
                fixed3 lightDirection = normalize(_WorldSpaceLightPos0.xyz - input.worldPosition * _WorldSpaceLightPos0.w);
                fixed diffuse = saturate(dot(normal, lightDirection));
                fixed3 ambient = ShadeSH9(fixed4(normal, 1.0));
                fixed3 viewDirection = normalize(_WorldSpaceCameraPos - input.worldPosition);
                fixed3 halfDirection = normalize(lightDirection + viewDirection);
                fixed specular = pow(saturate(dot(normal, halfDirection)), lerp(8.0, 64.0, _Glossiness))
                    * _SpecularStrength * diffuse;
                fixed3 lit = albedo * (ambient * 0.92 + _LightColor0.rgb * (0.35 + diffuse * 0.90))
                    + specular * _LightColor0.rgb;
                fixed4 output = fixed4(saturate(lit), _Color.a);
                UNITY_APPLY_FOG(input.fogCoord, output);
                return output;
            }
            ENDCG
        }
    }
}
