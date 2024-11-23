#ifndef VECTORS_H_
#define VECTORS_H_

#include <math.h>
#define PI 3.14159265358979323846

struct Float2
{
    Float2(float x, float y) : x(x), y(y) {}
    Float2(float a) : x(a), y(a) {}
    Float2() : x(0), y(0) {}
    float x, y;
};

inline Float2 operator-(const Float2 &a)
{
    return Float2(-a.x, -a.y);
}
inline Float2 operator-(const Float2 &a, const Float2 &b)
{
    return Float2(a.x - b.x, a.y - b.y);
}
inline Float2 operator-(const Float2 &a, const float b)
{
    return Float2(a.x - b, a.y - b);
}
inline Float2 operator-(const float a, const Float2 &b)
{
    return Float2(a - b.x, a - b.y);
}
inline Float2 operator+(const Float2 &a, const Float2 &b)
{
    return Float2(a.x + b.x, a.y + b.y);
}
inline Float2 operator+(const Float2 &a, const float b)
{
    return Float2(a.x + b, a.y + b);
}
inline Float2 operator+(const float a, const Float2 &b)
{
    return Float2(a + b.x, a + b.y);
}
inline Float2 operator*(const Float2 &a, const Float2 &b)
{
    return Float2(a.x * b.x, a.y * b.y);
}
inline Float2 operator*(const Float2 &a, const float b)
{
    return Float2(a.x * b, a.y * b);
}
inline Float2 operator*(const float a, const Float2 &b)
{
    return Float2(a * b.x, a * b.y);
}
inline Float2 operator/(const Float2 &a, const Float2 &b)
{
    return Float2(a.x / b.x, a.y / b.y);
}
inline Float2 operator/(const Float2 &a, const float b)
{
    return Float2(a.x / b, a.y / b);
}
inline Float2 operator/(const float a, const Float2 &b)
{
    return Float2(a / b.x, a / b.y);
}
inline void operator-=(Float2 &a, Float2 b)
{
    a.x -= b.x;
    a.y -= b.y;
}
inline void operator+=(Float2 &a, Float2 b)
{
    a.x += b.x;
    a.y += b.y;
}
inline void operator*=(Float2 &a, Float2 b)
{
    a.x *= b.x;
    a.y *= b.y;
}
inline void operator/=(Float2 &a, Float2 b)
{
    a.x /= b.x;
    a.y /= b.y;
}
inline float Dot(const Float2 &a, const Float2 &b)
{
    return a.x * b.x + a.y * b.y;
}
inline float Length(const Float2 &a)
{
    return sqrtf(Dot(a, a));
}
inline Float2 Normalize(const Float2 &a)
{
    float len = 1.0f / Length(a);
    return Float2(a.x * len, a.y * len);
}

struct Float3
{
    Float3(float x, float y, float z) : x(x), y(y), z(z) {}
    Float3(float a) : x(a), y(a), z(a) {}
    Float3(const struct Float4 &a);
    Float3() : x(0), y(0), z(0) {}
    float x, y, z;
};

inline Float3 operator-(const Float3 &a)
{
    return Float3(-a.x, -a.y, -a.z);
}
inline Float3 operator-(const Float3 &a, const Float3 &b)
{
    return Float3(a.x - b.x, a.y - b.y, a.z - b.z);
}
inline Float3 operator-(const Float3 &a, const float b)
{
    return Float3(a.x - b, a.y - b, a.z - b);
}
inline Float3 operator-(const float a, const Float3 &b)
{
    return Float3(a - b.x, a - b.y, a - b.z);
}
inline Float3 operator+(const Float3 &a, const Float3 &b)
{
    return Float3(a.x + b.x, a.y + b.y, a.z + b.z);
}
inline Float3 operator+(const Float3 &a, const float b)
{
    return Float3(a.x + b, a.y + b, a.z + b);
}
inline Float3 operator+(const float a, const Float3 &b)
{
    return Float3(a + b.x, a + b.y, a + b.z);
}
inline Float3 operator*(const Float3 &a, const Float3 &b)
{
    return Float3(a.x * b.x, a.y * b.y, a.z * b.z);
}
inline Float3 operator*(const Float3 &a, const float b)
{
    return Float3(a.x * b, a.y * b, a.z * b);
}
inline Float3 operator*(const float a, const Float3 &b)
{
    return Float3(a * b.x, a * b.y, a * b.z);
}
inline Float3 operator/(const Float3 &a, const Float3 &b)
{
    return Float3(a.x / b.x, a.y / b.y, a.z / b.z);
}
inline Float3 operator/(const Float3 &a, const float b)
{
    return Float3(a.x / b, a.y / b, a.z / b);
}
inline Float3 operator/(const float a, const Float3 &b)
{
    return Float3(a / b.x, a / b.y, a / b.z);
}
inline void operator-=(Float3 &a, Float3 b)
{
    a.x -= b.x;
    a.y -= b.y;
    a.z -= b.z;
}
inline void operator+=(Float3 &a, Float3 b)
{
    a.x += b.x;
    a.y += b.y;
    a.z += b.z;
}
inline void operator*=(Float3 &a, Float3 b)
{
    a.x *= b.x;
    a.y *= b.y;
    a.z *= b.z;
}
inline void operator/=(Float3 &a, Float3 b)
{
    a.x /= b.x;
    a.y /= b.y;
    a.z /= b.z;
}
inline float Dot(const Float3 &a, const Float3 &b)
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
}
inline float Length(const Float3 &a)
{
    return sqrtf(Dot(a, a));
}
inline Float3 Normalize(const Float3 &a)
{
    float len = 1.0f / Length(a);
    return Float3(a.x * len, a.y * len, a.z * len);
}
inline Float3 Cross(Float3 a, Float3 b)
{
    return Float3(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x);
}

struct Ray
{
    Float3 Position;
    Float3 Direction;
};


struct Camera
{
private:
    Float3 Position;
    Float3 LookAt;
    Float2 Resolution;
    float FieldOfView;
    float AspectRatio;

    Float3 TopLeft;
    Float3 Horizontal;
    Float3 Vertical;

public:
    Camera(Float3 pos, Float3 lookat, Float2 resolution, float fovY)
    {
        Position = pos;
        LookAt = lookat;
        Resolution = resolution;
        FieldOfView = fovY * PI / 180.0f;
        AspectRatio = resolution.x / resolution.y;

        UpdateViewport();
    }

    Float2 Project(const Float3 &pos)
    {
        Float3 direction = Normalize(LookAt - Position);
        Float3 planePosition = Position + direction;

        Ray ray = Ray { pos, Normalize(pos - Position) };
        float distance = Dot(planePosition - ray.Position, direction) / Dot(direction, ray.Direction);
        Float3 projected = pos + ray.Direction * distance;
        
        Float3 u = Normalize(Cross(direction, Float3(0, 0, 1)));
        Float3 v = Normalize(Cross(direction, u));

        float verticalAngle = FieldOfView * 0.5f;
        float width = Dot(projected, u) / tanf(verticalAngle);
        float height = Dot(projected, v) / tanf(verticalAngle / AspectRatio);

        Float2 diff = (Float2(width, height) + 1.0f) * 0.5f;
        return diff * Resolution;
    }

    void SetPosition(Float3 pos)
    {
        Position = pos;
        UpdateViewport();
    }

    void SetLookAt(Float3 lookat)
    {
		LookAt = lookat;
        UpdateViewport();
    }

    Ray CreateRay(int x, int y)
    {
        Float2 pixelCenter = Float2(x, y) + 0.5f;
        pixelCenter /= Resolution;

        Ray ray;
        ray.Position = Position;
        ray.Direction = TopLeft + pixelCenter.x * Horizontal + pixelCenter.y * Vertical;
        ray.Direction = Normalize(ray.Direction - ray.Position);
        return ray;
    }

private:
    void UpdateViewport()
    {
        Float3 w = Normalize(LookAt - Position);
        Float3 u = Normalize(Cross(w, Float3(0, 0, 1)));
        Float3 v = Cross(w, u);

        float h = tanf(FieldOfView * 0.5f);

        Horizontal = u * 2 * h * AspectRatio;
        Vertical = v * 2 * h;
        TopLeft = Position - Horizontal / 2 - Vertical / 2 + w;
    }
};

#endif