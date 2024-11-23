import math

class Vector:
    def __init__(self, *args):
        if len(args) == 0:
            self.values = [0,0]
        elif len(args) == 1:
            self.values = args[0]
        else: 
            self.values = list(args)
        self.dimension = len(self.values)
        self.values = [float(x) for x in self.values]

    def setx(self, x): self.values[0] = float(x)
    def sety(self, y): self.values[1] = float(y)        
    def setz(self, z): self.values[2] = float(z)     
    def setw(self, w): self.values[3] = float(w)   
        
    x = property(lambda self: self.values[0], setx)
    y = property(lambda self: self.values[1], sety)
    z = property(lambda self: self.values[2], setz)
    w = property(lambda self: self.values[3], setz)
	
    def __str__(self):
        return str(self.values)
    
    def __add__(self, other):
        if isinstance(other, Vector):
            dimension = min(self.dimension, other.dimension)
            return Vector([self.values[i] + other.values[i] for i in range(dimension)]) 
        elif isinstance(other, (int, float)):
            return Vector([self.values[i] + other for i in range(self.dimension)])
    
    def __sub__(self, other):
        return self.__add__(-other)
    
    def __neg__(self):
        return Vector([x * -1 for x in self.values])
    
    def __mul__(self, other):
        if isinstance(other, Vector):
            return self.dot(other)
        elif isinstance(other, (int, float)):
            return Vector([x * other for x in self.values])

    def __truediv__(self, other):
        if isinstance(other, Vector):
            dimension = min(self.dimension, other.dimension)
            return Vector([self.values[i] / other.values[i] for i in range(dimension)]) 
        elif isinstance(other, (int, float)):
            return Vector([x / other for x in self.values])
    
    def __radd__(self, other):
        return self.__add__(other)

    def __rsub__(self, other):
        return other.sub(self)
        
    def dot(self, other):
        dimension = min(self.dimension, other.dimension)
        result = 0.0
        for i in range(dimension):
            result += self.values[i] * other.values[i]
        return result
    
    def length(self):
        return math.sqrt(self.dot(self))
    
    def normalize(self):
        length = self.length()
        self.values = [x / length for x in self.values]

    def cross(self, other):
        if self.dimension == 3 and other.dimension == 3:
            return Vector(self.y * other.z - self.z * other.y, self.z * other.x - self.x * other.z, self.x * other.y - self.y * other.x)

def dot(v, v2):
    return v.dot(v2)

def length(v):
    return math.sqrt(v.dot(v))

def normalize(v):
    length = v.length()
    return Vector([x / length for x in v.values])

def cross(v, v2):
    if v.dimension == 3 and v2.dimension == 3:
        return Vector(v.y * v2.z - v.z * v2.y, v.z * v2.x - v.x * v2.z, v.x * v2.y - v.y * v2.x)