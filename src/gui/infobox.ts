import { Rectangle, Ellipse, Control, TextBlock, Button, StackPanel, Container } from "babylonjs-gui";
import { Vector3 } from '../tools';
import { ipcRenderer } from 'electron';
import { GuiTexture } from './guitexture';

export class Infobox extends Container {
  guiTexture: GuiTexture;
  panel: StackPanel;
  fillRectangle: Rectangle;
  heading: Rectangle;

  constructor(name: string, preview: boolean, guiTexture: GuiTexture) {
    super(name);
    this.guiTexture = guiTexture;
    this.widthInPixels = 300;
    this.adaptHeightToChildren = true;
    this.setPaddingInPixels(10);
    this.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.zIndex = 20;
    this.fillRectangle = new Rectangle("background");
    this.fillRectangle.alpha = 0.6;
    this.fillRectangle.thickness = 0;
    this.fillRectangle.cornerRadius = 5;
    this.isPointerBlocker = true;
    this.addControl(this.fillRectangle);
    this.panel = new StackPanel("infoboxPanel");
    this.addControl(this.panel);
    this.heading = buildHeading(this);
    this.panel.addControl(this.heading);
    this.setPreview(preview);
  }
  setPreview(preview: boolean) {
    if(preview) this.color = "rgb(60,215,60)"
    else this.color = "rgb(255,110,90)"
    this.fillRectangle.background = this.color;
    this.heading.background = this.color;
  }
  addControls(){return}
  removeControls(){return}
}

const buildHeading = (infobox: Infobox) => {
  const heading = new Rectangle("headingBackground");
  heading.height = "30px";
  heading.thickness = 0;
  heading.alpha = 0.8;
  heading.cornerRadius = 5;
  const block = new TextBlock("headingText");
  block.text = infobox.name;
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.fontSize = 20;
  block.fontFamily = "monospace";
  block.paddingLeft = "5px";
  block.color = "black";
  block.onPointerDownObservable.add((vec) => {
    ipcRenderer.emit('startGuiDrag', 'dragEvent', infobox, vec);
    heading.thickness = 1;
  });
  block.onPointerUpObservable.add(() => {
    ipcRenderer.emit('stopGuiDrag', 'dragEvent', infobox);
    heading.thickness = 0;
  });
  block.onPointerEnterObservable.add(() => {
    heading.alpha = 0.6;
    infobox.fillRectangle.thickness = 1;
  });
  block.onPointerOutObservable.add(() => {
    if(heading.thickness > 0) return;
    heading.alpha = 0.8;
    infobox.fillRectangle.thickness = 0;
  });
  heading.addControl(block);
  const button = Button.CreateSimpleButton("closeButton","🗙");
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.width = "30px";
  button.height = "30px";
  button.fontSize = "60%";
  button.setPaddingInPixels(2);
  button.color = "lightgrey";
  button.textBlock.color = "black";
  button.thickness = 0;
  button.onPointerEnterObservable.add(() => button.thickness = 1);
  button.onPointerOutObservable.add(() => button.thickness = 0);
  button.onPointerClickObservable.add(() => {
    ipcRenderer.emit("notifyStatus", "closeEvent", infobox.name, true);
  });
  heading.addControl(button);
  return heading;
}

export const pad = (str: string, size: number) => {
  const s = "          " + str;
  return s.substr(s.length - size);
}

export const printPosition = (pos: number[]) => {
  return pos.map(e => pad(e.toFixed(0), 5)).join();
}

export const printDegree = (rad: number) => {
  return pad((180*rad/Math.PI).toFixed(2), 8) + "°";
}

export const buildText = (content: string) => {
  const block = new TextBlock("infoText");
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.fontFamily = "monospace";
  block.height = "25px";
  block.paddingLeft = "5px";
  block.color = "black";
  return block;
}

export const buildGauge = (infobox: Infobox, isRotationGauge: boolean) => {
  const gauge = new Container();
  const scaling = 0.8*infobox.widthInPixels;
  gauge.widthInPixels = infobox.widthInPixels;
  gauge.heightInPixels = scaling;

  const buildScale = (angle: number) => {
    const scale = new Container();
    for(let i = 0; i<=10; i++) {
      const mark1 = new Rectangle();
      mark1.widthInPixels = 0.01*scaling;
      mark1.heightInPixels = (i % 5 == 0 ? 0.5 : 0.03)*scaling;
      mark1.background = "black";
      mark1.alpha = 0.8;
      mark1.thickness = 0;
      mark1.rotation = Math.PI/6;
      mark1.topInPixels = 0.5*mark1.heightInPixels*Math.cos(Math.PI/6);
      mark1.leftInPixels = (i-5)*0.05*scaling - 0.5*mark1.heightInPixels*Math.sin(Math.PI/6);
      scale.addControl(mark1);
      const mark2 = mark1.clone();
      mark2.rotation = -Math.PI/6;
      mark2.topInPixels = -mark1.topInPixels;
      scale.addControl(mark2);
    }
    scale.topInPixels = 0.25*Math.sin(angle)*scaling;
    scale.leftInPixels = 0.25*Math.cos(angle)*scaling;
    scale.rotation = angle;
    gauge.addControl(scale);
    return scale;
  }
  buildScale(0*Math.PI/3);
  buildScale(2*Math.PI/3);
  buildScale(4*Math.PI/3);

  const setKnob = (knob: Ellipse, angles: number[]) => {
    let top = 0;
    let left = 0;
    for(let i = 0; i < 3; i++) {
      top += angles[i]*Math.sin((1+2*i)*Math.PI/3)*0.25*scaling;
      left += angles[i]*Math.cos((1+2*i)*Math.PI/3)*0.25*scaling;
    }
    knob.topInPixels = top;
    knob.leftInPixels = left;
    knob.color = "black";
  }
  const buildKnob = (angles: number[]) => {
    const knob = new Ellipse()
    knob.widthInPixels = 0.1*scaling;
    knob.heightInPixels = 0.1*scaling;
    knob.thickness = 0.015*scaling;
    setKnob(knob, angles);
    gauge.addControl(knob);
    return knob;
  }
  const knob1 = buildKnob([0, -1, -1]);
  const knob2 = buildKnob([-1, 0, -1]);
  const knob3 = buildKnob([-1, -1, 0]);

  const sendRequest = (vec: number[]) => {
    if(pointerDown) {
      const destName = infobox.name.replace("hub", "leg");
      if(isRotationGauge) ipcRenderer.send(destName, "requestRotationSpeed", vec.map(x => 100*x));
      else ipcRenderer.send(destName, "requestPositionSpeed", vec.map(x => 100*x));
    }
  }

  let pointerDown = false;
  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  const gaugeOnPointer = (vec) => {
    const xval = 4*(vec.x - mouseOverlay.centerX)/(scaling*infobox.guiTexture.getScale());
    const yval = 4*(vec.y - mouseOverlay.centerY)/(scaling*infobox.guiTexture.getScale());

    const base = [];
    for(let i = 0; i < 3; i++) {
      base[i] = [Math.sin((1+2*i)*Math.PI/3), Math.cos((1+2*i)*Math.PI/3)];
    }
    const s = [[],[],[]];
    for(let i = 0; i < 3; i++) {
      for(let j = 0; j < 3; j++) {
        s[i][j] = (xval/base[i][1] - yval/base[i][0])/(base[j][0]/base[i][0] - base[j][1]/base[i][1]);
	if(Math.abs(s[i][j] - 1) < 0.1) s[i][j] = 1; //snap to neutral
	if(s[i][j] > 2) s[i][j] = 2; //snap to border
      }
    }
    if(knob3.color == infobox.color || (knob1.color != infobox.color && knob2.color != infobox.color && s[0][1] > 0 && s[1][0] > 0)) {
      if(s[0][1] < 0) s[0][1] = 0;
      if(s[1][0] < 0) s[1][0] = 0;
      setKnob(knob3, [-s[1][0], -s[0][1], 0]);
      knob3.color = pointerDown? infobox.color : "lightgrey";
      if(isRotationGauge) {
        sendRequest([1-s[1][0], 0, 1-s[0][1]]);
        setKnob(knob1, [0, -1, -2+s[1][0]]);
        setKnob(knob2, [-1, 0, -2+s[0][1]]);
      }
      else {
        sendRequest([1-s[0][1], 0, 1-s[1][0]]);
        setKnob(knob1, [0, -s[0][1], -1]);
        setKnob(knob2, [-s[1][0], 0, -1]);
      }
    }
    else if(knob1.color == infobox.color || (knob2.color != infobox.color && s[1][2] > 0 && s[2][1] > 0)) {
      if(s[1][2] < 0) s[1][2] = 0;
      if(s[2][1] < 0) s[2][1] = 0;
      setKnob(knob1, [0, -s[2][1], -s[1][2]]);
      knob1.color = pointerDown? infobox.color : "lightgrey";
      if(isRotationGauge) {
        sendRequest([1-s[1][2], 1-s[2][1], 0]);
        setKnob(knob2, [-2+s[2][1], 0, -1]);
        setKnob(knob3, [-2+s[1][2], -1, 0]);
      }
      else {
        sendRequest([1-s[2][1], 1-s[1][2], 0]);
        setKnob(knob2, [-1, 0, -s[1][2]]);
        setKnob(knob3, [-1, -s[2][1], 0]);
      }
    }
    else if(knob2.color == infobox.color || (s[0][2] > 0 && s[2][0] > 0)) {
      if(s[0][2] < 0) s[0][2] = 0;
      if(s[2][0] < 0) s[2][0] = 0;
      setKnob(knob2, [-s[2][0], 0, -s[0][2]]);
      knob2.color = pointerDown? infobox.color : "lightgrey";
      if(isRotationGauge) {
        sendRequest([0, 1-s[2][0], 1-s[0][2]]);
        setKnob(knob1, [0, -2+s[2][0], -1]);
        setKnob(knob3, [-1, -2+s[0][2], 0]);
      }
      else {
        sendRequest([0, 1-s[0][2], 1-s[2][0]]);
        setKnob(knob1, [0, -1, -s[0][2]]);
        setKnob(knob3, [-s[2][0], -1, 0]);
      }
    }
    else {
      sendRequest([0, 0, 0]);
      setKnob(knob1, [0, -1, -1]);
      setKnob(knob2, [-1, 0, -1]);
      setKnob(knob3, [-1, -1, 0]);
    }
  }
  mouseOverlay.onPointerMoveObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerOutObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerDownObservable.add((vec) => {
    pointerDown = true;
    gaugeOnPointer(vec); 
  });
  mouseOverlay.onPointerUpObservable.add((vec) => {
    sendRequest([0, 0, 0]);
    pointerDown = false;
    gaugeOnPointer(vec); 
  });
  gauge.addControl(mouseOverlay);
  return gauge;
}
