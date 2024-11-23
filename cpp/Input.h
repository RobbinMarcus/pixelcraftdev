#ifndef INPUT_H_
#define INPUT_H_

typedef double f64;

#define WASM_EXPORT __attribute__((__visibility__("default")))

class Input 
{
public:
    static Input& get()
    {
        static Input instance;
        return instance;
    }
    static f64 mouseX;
    static f64 mouseY;
};

f64 Input::mouseX = 0;
f64 Input::mouseY = 0;

extern "C" 
{
    WASM_EXPORT void input_setMousePosition(f64 x, f64 y)
    {
        Input::mouseX = x;
        Input::mouseY = y;
    }
}

#endif // INPUT_H_