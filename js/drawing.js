// Math library

class Float2 
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }

    Add(v)
    {
        return new Float2(this.x + v.x, this.y + v.y);
    }

    Subtract(v)
    {
        return new Float2(this.x - v.x, this.y - v.y);
    }

    Multiply(v)
    {
        return new Float2(this.x * v.x, this.y * v.y);
    }

    Divide(v)
    {
        return new Float2(this.x / v.x, this.y / v.y);
    }

    static Dot(a, b)
    {
        return a.x * b.x + a.y * b.y;
    }

    static Length(v)
    {
        return Math.sqrt(Float2.Dot(v, v));
    }

    static Normalize(v)
    {
        var len = 1.0 / Float2.Length(v);
        return new Float2(v.x * len, v.y * len);
    }
}

class Float3
{
    constructor(x, y, z)
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    Add(v)
    {
        return new Float3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    Subtract(v)
    {
        return new Float3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    Multiply(v)
    {
        return new Float3(this.x * v.x, this.y * v.y, this.z * v.z);
    }

    Divide(v)
    {
        return new Float3(this.x / v.x, this.y / v.y, this.z / v.z);
    }

    static Dot(a, b)
    {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static Cross(a, b)
    {
        return new Float3(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x);
    }

    static Length(v)
    {
        return Math.sqrt(Float3.Dot(v, v));
    }

    static Normalize(v)
    {
        var len = 1.0 / Float3.Length(v);
        return new Float3(v.x * len, v.y * len, v.z * len);
    }
}

class Matrix2
{
    constructor(values)
    {
        if (Array.isArray(values) && values.length == 4)
        {
            this.data = values;
        }
        else
        {
            this.data = Array(4).fill(0);
        }
    }

    MultiplyVector(v)
    {
        return new Float2(
            v.x * this.data[0] + v.y * this.data[1],
            v.x * this.data[2] + v.y * this.data[3],
        );
    }
}

class Matrix4
{
    constructor(values)
    {
        if (Array.isArray(values) && values.length == 16)
        {
            this.data = values;
        }
        else
        {
            this.data = Array(16).fill(0);
        }
    }

    MultiplyVector(v)
    {
        return new Float4(
            v.x * this.data[0] + v.y * this.data[1] + v.z * this.data[2] + v.w * this.data[3],
            v.x * this.data[4] + v.y * this.data[5] + v.z * this.data[6] + v.w * this.data[7],
            v.x * this.data[8] + v.y * this.data[9] + v.z * this.data[10] + v.w * this.data[11],
            v.x * this.data[12] + v.y * this.data[13] + v.z * this.data[14] + v.w * this.data[15],
        );
    }
}


class Ray 
{
    constructor(pos, dir)
    {
        this.Position = pos;
        this.Direction = dir;
    }
}

class Camera
{
    constructor(pos, lookat, resolution, fovY)
    {
        this.Position = pos;
        this.LookAt = lookat;
        this.Resolution = resolution;
        this.FieldOfView = fovY * Math.PI / 180.0;
        this.AspectRatio = resolution.x / resolution.y;
    }

    Project(pos)
    {
        var direction = Float3.Normalize(this.LookAt.Subtract(this.Position));
        var planePosition = this.Position.Add(direction);

        var ray = new Ray(pos, Float3.Normalize(pos.Subtract(this.Position)));
        var distance = Float3.Dot(planePosition.Subtract(ray.Position), direction) / Float3.Dot(direction, ray.Direction);
        var projected = pos.Add(ray.Direction.Multiply(new Float3(distance, distance, distance)));

        var u = Float3.Normalize(Float3.Cross(direction, new Float3(0, 0, 1)));
        var v = Float3.Normalize(Float3.Cross(direction, u));

        var verticalAngle = this.FieldOfView * 0.5;
        var width = Float3.Dot(projected, u) / Math.tan(verticalAngle);
        var height = Float3.Dot(projected, v) / Math.tan(verticalAngle / this.AspectRatio);

        var diff = new Float2(width, height).Add(new Float2(1.0, 1.0)).Multiply(new Float2(0.5, 0.5));
        return diff.Multiply(this.Resolution);
    }

    SetPosition(pos)
    {
        this.Position = pos;
    }

    SetLookAt(lookat)
    {
        this.LookAt = lookat;
    }
}


// Drawing functions

function ClearCanvas(c, width, height, color)
{
    c.fillStyle = color;
    c.fillRect(0, 0, width, height);
}

function DrawLine(c, from, to, color, width = 1)
{
    c.beginPath();
    c.lineWidth = width;
    c.strokeStyle = color;
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
}

function DrawText(c, pos, message, color, font = "15pt Helvetica, Arial") 
{
    c.font = font;
    c.fillStyle = color;
    c.fillText(message, pos.x, pos.y);
}

function DrawDisc(c, center, radius, color)
{
    c.beginPath();
    c.arc(center.x, center.y, radius, 0, 2 * Math.PI, false);
    c.fillStyle = color;
    c.fill();
}
