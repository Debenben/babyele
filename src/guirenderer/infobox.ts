import { Rectangle, Control, TextBlock, Button, StackPanel, Container, Image, Grid } from "babylonjs-gui";
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
    this.fillRectangle.thickness = 1;
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
    this.color = preview ? "#3cd73c80" : "#ff6e5a80";
    this.fillRectangle.background = this.color;
    this.fillRectangle.color = preview ? "#3cd73cc0" : "#ff6e5ac0";
    this.heading.background = this.fillRectangle.color;
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
  block.fontSize = "20px";
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
    infobox.fillRectangle.color = "lightgrey";
  });
  block.onPointerOutObservable.add(() => {
    if(heading.thickness > 0) return;
    heading.alpha = 0.8;
    infobox.fillRectangle.color = heading.background;
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
    infobox.guiTexture.renderer.setState(infobox.name, "online");
  });
  heading.addControl(button);
  return heading;
}

export const buildText = (content: string) => {
  const block = new TextBlock("infoText");
  block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.text = content;
  block.height = "25px";
  block.fontSize = "20px";
  block.setPaddingInPixels(0, 2, 0, 2);
  block.color = "black";
  return block;
}

export class ThreePrint extends Grid {
  coordText: TextBlock[] = [null, null, null]

  constructor(labelText: string) {
    super(labelText);
    this.heightInPixels = 22;
    this.setPaddingInPixels(0, 2, 2, 2);
    this.addColumnDefinition(0.2);
    const filler = new Rectangle("filler");
    filler.background = "#000000c0";
    filler.thickness = 0;
    this.addControl(filler, 0, 0);
    const label = buildText(labelText);
    label.color = undefined;
    this.addControl(label, 0, 0);
    for(let i=0; i<3; i++) {
      this.addColumnDefinition(2, true);
      this.addColumnDefinition(0.3);
      const filler = new Rectangle("filler");
      filler.background = "#00000030";
      filler.thickness = 0;
      this.addControl(filler, 0, 2*(i + 1));
      this.coordText[i] = buildText("---");
      this.coordText[i].textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.addControl(this.coordText[i], 0, 2*(i + 1));
    }
  }
  setThreeText(vec3: string[]) {
    for(let i=0; i<3; i++) {
      this.coordText[i].text = vec3[i];
    }
  }
}

export class ToggleButton extends Container {
  enabled: boolean;
  button1: Button;
  button2: Button;
  callback: (enabled: boolean) => any;
  constructor(enabledText: string, disabledText: string, callback: (enabled: boolean) => any) {
    super()
    this.callback = callback;
    this.setPaddingInPixels(0, 2, 2, 2);
    this.height = "26px";
    this.button1 = this.buildButton(enabledText);
    this.button2 = this.buildButton(disabledText);
    const grid = new Grid("toggleGrid");
    grid.addColumnDefinition(1);
    grid.addColumnDefinition(1);
    grid.addControl(this.button1, 0, 0);
    grid.addControl(this.button2, 0, 1);
    this.addControl(grid);
    this.setEnabled(false);
  }
  buildButton(text: string) {
    const button = Button.CreateSimpleButton("button", text);
    button.thickness = 0;
    button.fontSize = "80%";
    button.onPointerEnterObservable.add(() => button.thickness = 1);
    button.onPointerOutObservable.add(() => button.thickness = 0);
    button.onPointerClickObservable.add(() => {
      this.setEnabled(!this.enabled);
      this.callback(this.enabled);
    });
    return button;
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.button1.background = enabled ? "#00000040" : "#000000c0";
    this.button2.background = enabled ? "#000000c0" : "#00000040";
  }
}

export const base = [[Math.sin(Math.PI/3), 0.5], [0, -1], [-Math.sin(Math.PI/3), 0.5]];

export class Gauge extends Container {
  ind1: Container;
  ind2: Container;
  ind3: Container;
  setIndicatorPosition: (position: number[]) => void;
}

class Knob extends Container {
  highlight = false;
  select = false;
  knobImage = new Image("knob", "../public/crosshair_u.svg");
  constructor() {
    super();
    this.widthInPixels = 30;
    this.heightInPixels = 30;
    this.addControl(this.knobImage);
  }
  updateImage() {
    this.knobImage.source = "../public/crosshair_" + (this.select ? "s" : (this.highlight ? "h" : "u")) + ".svg";
  }
}

export const buildGauge = (infobox: Infobox, isRotationGauge: boolean) => {
  const gauge = new Gauge();
  const scaling = 0.8*infobox.widthInPixels;
  gauge.widthInPixels = infobox.widthInPixels;
  gauge.heightInPixels = scaling;

  const scale = new Image("scale", "../public/cube.svg");
  gauge.addControl(scale);

  const setKnob = (knob: Container, angles: number[]) => {
    knob.topInPixels = (angles[0]*base[0][0] + angles[1]*base[1][0] + angles[2]*base[2][0])*0.25*scaling;
    knob.leftInPixels = (angles[0]*base[0][1] + angles[1]*base[1][1] + angles[2]*base[2][1])*0.25*scaling;
    if(knob instanceof Knob) (knob as Knob).updateImage();
  }
  const buildKnob = (angles: number[], rotation: number) => {
    const knob = new Knob()
    knob.knobImage.rotation = rotation;
    setKnob(knob, angles);
    gauge.addControl(knob);
    return knob;
  }
  const buildIndicator = (angles: number[], rotation: number) => {
    const arrow = new Container();
    arrow.rotation = rotation;
    arrow.widthInPixels = 30;
    arrow.heightInPixels = 30;
    const image = new Image("arrow", "../public/skew_arrow.svg");
    arrow.addControl(image);
    setKnob(arrow, angles);
    gauge.addControl(arrow);
    return arrow;
  }

  gauge.ind1 = buildIndicator([2, 1, 0], 0);
  gauge.ind2 = buildIndicator([0, 2, 1], 2*Math.PI/3);
  gauge.ind3 = buildIndicator([1, 0, 2], -2*Math.PI/3);
  gauge.setIndicatorPosition = (position: number[]) => {
    if(isRotationGauge) {
      setKnob(gauge.ind1, [2, 1 + position[2], 0]);
      setKnob(gauge.ind2, [0, 2, 1 + position[0]]);
      setKnob(gauge.ind3, [1 + position[1], 0, 2]);
    }
    else {
      setKnob(gauge.ind1, [2, 1 + position[0], 0]);
      setKnob(gauge.ind2, [0, 2, 1 - position[1]]);
      setKnob(gauge.ind3, [1 + position[2], 0, 2]);
    }
  };

  const knob1 = buildKnob([0, -1, -1],  0);
  const knob2 = buildKnob([-1, 0, -1],  2*Math.PI/3);
  const knob3 = buildKnob([-1, -1, 0], -2*Math.PI/3);

  const sendRequest = (vec: number[]) => {
    if(pointerDown && vec.every((e) => !isNaN(e))) {
      const destName = infobox.name.replace("hub", "leg");
      if(isRotationGauge) ipcRenderer.send(destName, "requestRotationSpeed", vec.map(x => 100*x));
      else ipcRenderer.send(destName, "requestPositionSpeed", [100*vec[0], -100*vec[1], 100*vec[2]]);
    }
  }

  let pointerDown = false;
  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  const gaugeOnPointer = (vec) => {
    const xval = 4*(vec.x - mouseOverlay.centerX)/(scaling*infobox.guiTexture.getScale());
    const yval = 4*(vec.y - mouseOverlay.centerY)/(scaling*infobox.guiTexture.getScale());

    const s: number[][] = [[],[],[]];
    for(let i = 0; i < 3; i++) {
      for(let j = 0; j < 3; j++) {
        if(i === j) continue;
        s[i][j] = (xval*base[i][0] - yval*base[i][1])/(base[j][0]*base[i][1] - base[j][1]*base[i][0]);
	if(Math.abs(s[i][j] - 1) < 0.1) s[i][j] = 1; //snap to neutral
	if(s[i][j] > 2) s[i][j] = 2; //snap to border
      }
    }
    knob1.highlight = true;
    knob2.highlight = true;
    knob3.highlight = true;
    if(knob3.select || (!knob1.select && !knob2.select && s[0][1] > 0 && s[1][0] > 0)) {
      knob3.select = pointerDown;
      if(s[0][1] < 0) s[0][1] = 0;
      if(s[1][0] < 0) s[1][0] = 0;
      setKnob(knob3, [-s[1][0], -s[0][1], 0]);
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
    else if(knob1.select || (!knob2.select && s[1][2] > 0 && s[2][1] > 0)) {
      knob1.select = pointerDown;
      if(s[1][2] < 0) s[1][2] = 0;
      if(s[2][1] < 0) s[2][1] = 0;
      setKnob(knob1, [0, -s[2][1], -s[1][2]]);
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
    else if(knob2.select || (s[0][2] > 0 && s[2][0] > 0)) {
      knob2.select = pointerDown;
      if(s[0][2] < 0) s[0][2] = 0;
      if(s[2][0] < 0) s[2][0] = 0;
      setKnob(knob2, [-s[2][0], 0, -s[0][2]]);
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
      knob1.highlight = false;
      knob2.highlight = false;
      knob3.highlight = false;
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
