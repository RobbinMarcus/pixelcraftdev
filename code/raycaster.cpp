#include "Drawing.h"
#include <canvas.h>
#include <vector>

struct Sphere
{
    Float3 Position;
    float Radius;
};

class SimpleCamera
{
public:
    Float3 Position;
    Float3 Direction;
    Float2 Resolution;

private:
    Float3 Horizontal;
    Float3 Vertical;
    Float3 TopLeft;

public:
    SimpleCamera(Float3 position, Float3 direction, Float2 resolution)
    {
        Position = position;
        Direction = Normalize(direction);
        Resolution = resolution;

        UpdateViewport();
    }

    void UpdateViewport()
    {
        // Calculate orthonormal basis: 3 vectors that are all perpendicular to each other
        Float3 w = Direction;
        Float3 u = Normalize(Cross(w, Float3(0, 0, 1)));
        Float3 v = Cross(w, u);

        // Aspectratio is the ratio between the x and y length of the viewport
        float aspectRatio = Resolution.x / Resolution.y;
        // We describe the viewport in 3 variables:
        // TopLeft: top left position of the viewport
        // Horizontal: TopLeft + horizontal moves over the x-axis of the viewport
        // Vertical: TopLeft + vertical moves over the y-axis of the viewport
        Horizontal = u * 2 *  aspectRatio;
        Vertical = v * 2;
        TopLeft = Position - Horizontal / 2 - Vertical / 2 + w;
    }

    Ray CreateRay(int x, int y)
    {
        // Calculate the center of the pixel in between [0, 1]
        Float2 pixelCenter = Float2(x, y) + 0.5f;
        pixelCenter /= Resolution;
        // The ray position start at the camera position
        // The ray direction is determined by calculating a position on the viewport and subtracting the position
        Ray ray;
        ray.Position = Position;
        ray.Direction = TopLeft + pixelCenter.x * Horizontal + pixelCenter.y * Vertical;
        ray.Direction = Normalize(ray.Direction - ray.Position);
        return ray;
    }
};

class Scene
{
public:
    std::vector<Sphere> Spheres;

    void AddSphere(Sphere sphere)
    {
        // Add the sphere to the list
        Spheres.push_back(sphere);
    }

    bool IntersectSphere(const Ray &ray, const Sphere &sphere)
    {
        Float3 difference = ray.Position - sphere.Position;
        auto a = Dot(ray.Direction, ray.Direction);
        auto b = 2.0f * Dot(difference, ray.Direction);
        auto c = Dot(difference, difference) - sphere.Radius * sphere.Radius;
        auto discriminant = b * b - 4 * a * c;
        return discriminant > 0.0f;
    }

    Float3 TraceRay(const Ray &ray)
    {
        // Intersection test with all spheres
        for (const Sphere &sphere : Spheres)
        {
            if (IntersectSphere(ray, sphere))
            {
                return Float3(1, 0, 0);
            }
        }

        // If none intersected return a blue sky color
        return Float3(0.5f, 0.7f, 1.0f);
    }
};

int main()
{
    int w = 400;
    int h = 300;

    SimpleCamera camera = SimpleCamera(Float3(0), Float3(0, 1, 0), Float2(w, h));
    Scene scene = Scene();
    scene.AddSphere(Sphere { Float3(0, 10, 0), 3.0f });

    Canvas C(w, h);
    ImageData image(w, h);
    for (int y = 0; y < h; y++)
    {
        for (int x = 0; x < w; x++)
        {
            Ray ray = camera.CreateRay(x, y);
            Float3 c = scene.TraceRay(ray) * 255.0f;
            image.data[y * w + x] = RGB(c.x, c.y, c.z);
        }
    }
    image.commit();
    C.putImageData(image, 0, 0);
}