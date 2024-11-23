#ifndef DRAWING_H_
#define DRAWING_H_

#include "VectorMath.h"
#include "canvas.h"

void ClearCanvas(Canvas c, int width, int height, const char* color)
{
    c.setFillStyle(color);
    c.fillRect(0, 0, width, height);
}

void DrawLine(Canvas c, Float2 from, Float2 to, const char* color, int width = 1)
{
    c.beginPath();
    c.setLineWidth(width);
    c.setStrokeStyle(color);
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
}

void DrawText(Canvas c, Float2 pos, const char* message, const char* color, const char* font = "15pt Helvetica, Arial") 
{
    c.setFont(font);
    c.setFillStyle(color);
    c.fillText(message, pos.x, pos.y);
}

void DrawDisc(Canvas c, Float2 center, float radius, const char* color)
{
    c.beginPath();
    c.arc(center.x, center.y, radius, 0, 2 * PI, false);
    c.setFillStyle(color);
    c.fill(FILL_RULE_NONZERO);
}

#endif