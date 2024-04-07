import { Rectangle, Ellipse, TextBlock, Container, Control } from "babylonjs-gui";
import { ipcRenderer } from 'electron';
import { Infobox, buildText, printDegree } from './infobox';

export class LegInfobox extends Infobox {
  gauge: Container;
  speedArrow: Container;
  angleArrow: Container;
  tiltArrow: Container;
  rotationValue: number = 0;
  tiltValue: number = 0;
  infoText: TextBlock;

  constructor(name: string, preview: boolean, guiTexture) {
    super(name, preview, guiTexture);
    this.addControls();
  }
  addControls() {
    this.gauge = buildAngleGauge(this);
    this.panel.addControl(this.gauge);
    ipcRenderer.on('notifyLegRotation', this.updateAngle);
    ipcRenderer.on('notifyTilt', this.updateTilt);
    ipcRenderer.send(this.name.replace("Top","").replace("Bottom","").replace("Mount",""), "getProperties");
  }
  removeControls() {
    ipcRenderer.removeListener('notifyLegRotation', this.updateAngle);
    ipcRenderer.removeListener('notifyTilt', this.updateTilt);
  }
  updateTilt = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.tiltValue = extractCoordinate(arg2, this.name);
      this.tiltArrow.rotation = rotationToGauge(this.tiltValue);
      if(this.tiltArrow.getDescendants()[0].getDescendants()[0].color == "lightgrey") {
	this.infoText.text = printDegree(this.tiltValue);
      }
    }
  }
  updateAngle = (event, arg1, arg2) => {
    if(this.name.startsWith(arg1)) {
      this.rotationValue = extractCoordinate(arg2, this.name);;
      if(this.angleArrow.getDescendants()[0].getDescendants()[0].color == "black") {
        this.angleArrow.rotation = rotationToGauge(this.rotationValue);
        if(this.infoText.color == "black") this.infoText.text = printDegree(this.rotationValue);
      }
    }
  }
}

const extractCoordinate = (vec3: number[], partName: string) => {
  if(partName.endsWith("Mount")) return vec3[0];
  else if(partName.endsWith("Top")) return vec3[1];
  else if(partName.endsWith("Bottom")) return vec3[2];
}
const gaugeToRotation = (angle: number) => {
  return angle > 0 ? Math.PI - angle : -Math.PI - angle;
}
const rotationToGauge = gaugeToRotation;
const gaugeToSpeed = (angle: number) => {
  return Math.round(2000*angle/Math.PI);
}

const buildAngleGauge = (infobox: LegInfobox) => {
  const gauge = new Container();
  gauge.widthInPixels = 0.8*infobox.widthInPixels;
  gauge.heightInPixels = 0.8*infobox.widthInPixels;
  gauge.paddingBottomInPixels = -0.1*infobox.widthInPixels;
  const innerRadius = 0.25*gauge.widthInPixels;
  const middleRadius = 0.375*gauge.widthInPixels;
  const outerRadius = 0.5*gauge.widthInPixels;

  const scale1 = new Container();
  scale1.widthInPixels = 2*outerRadius;
  scale1.heightInPixels = outerRadius;
  scale1.topInPixels = -0.5*outerRadius;
  scale1.alpha = 0.8;
  const ellipse1 = new Ellipse();
  ellipse1.widthInPixels = 2*outerRadius;
  ellipse1.heightInPixels = 2*outerRadius;
  ellipse1.topInPixels = -scale1.topInPixels;
  ellipse1.thickness = 0.03*outerRadius;
  ellipse1.color = "black";
  scale1.addControl(ellipse1);
  for(let i=0; i<=20; i++) {
    const angle = -i*Math.PI/20 - Math.PI/2
    const mark = new Rectangle();
    mark.background = "black";
    mark.thickness = 0;
    mark.rotation = angle;
    mark.topInPixels = Math.cos(angle)*outerRadius*0.95 + 0.5*outerRadius;
    mark.leftInPixels = -Math.sin(angle)*outerRadius*0.95;
    mark.widthInPixels = 0.02*outerRadius;
    mark.heightInPixels = (i % 10 == 0 ? 0.3 : 0.1)*outerRadius;
    scale1.addControl(mark);
  }
  gauge.addControl(scale1);

  const scale2 = new Container();
  scale2.alpha = 0.8;
  const ellipse3 = new Ellipse();
  ellipse3.widthInPixels = 2*innerRadius;
  ellipse3.heightInPixels = 2*innerRadius;
  ellipse3.thickness = 0.03*outerRadius;
  ellipse3.color = "black";
  scale2.addControl(ellipse3);
  for(let i=0; i<32; i++) {
    const angle = i*Math.PI/16 + 0.000001; // offset for accurate location of 180 degree mark
    const mark = new Rectangle();
    mark.background = "black";
    mark.thickness = 0;
    mark.rotation = angle;
    mark.topInPixels = Math.cos(angle)*innerRadius;
    mark.leftInPixels = -Math.sin(angle)*innerRadius;
    mark.widthInPixels = 0.02*outerRadius;
    mark.heightInPixels = (i % 4 == 0 ? 0.3 : 0.1)*outerRadius;
    scale2.addControl(mark);
  }
  gauge.addControl(scale2);

  infobox.infoText = buildText("---");
  infobox.infoText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  gauge.addControl(infobox.infoText);

  infobox.speedArrow = new Container();
  infobox.speedArrow.widthInPixels = 2*outerRadius;
  infobox.speedArrow.heightInPixels = 2*outerRadius;
  const clip2 = new Container();
  clip2.widthInPixels = 0.1*gauge.widthInPixels;
  clip2.heightInPixels = 0.5*gauge.widthInPixels;
  clip2.topInPixels = -0.65*gauge.widthInPixels;
  const rect1 = new Rectangle();
  rect1.widthInPixels = gauge.widthInPixels*0.68;
  rect1.heightInPixels = gauge.widthInPixels*0.68;
  rect1.rotation = Math.PI/4;
  rect1.background = "black";
  rect1.color = "black";
  rect1.alpha = 0.8;
  rect1.thickness = 0.02*outerRadius;
  rect1.topInPixels = -clip2.topInPixels;
  clip2.addControl(rect1);
  infobox.speedArrow.addControl(clip2);
  gauge.addControl(infobox.speedArrow);

  infobox.angleArrow = new Container();
  infobox.angleArrow.widthInPixels = 2*middleRadius;
  infobox.angleArrow.heightInPixels = 2*middleRadius;
  const clip3 = new Container();
  clip3.widthInPixels = 0.1*gauge.widthInPixels;
  clip3.heightInPixels = 0.5*gauge.widthInPixels;
  clip3.topInPixels = -0.1*gauge.widthInPixels;
  const rect2 = new Rectangle();
  rect2.widthInPixels = gauge.widthInPixels*0.5;
  rect2.heightInPixels = gauge.widthInPixels*0.5;
  rect2.rotation = Math.PI/4;
  rect2.background = "black";
  rect2.color = "black";
  rect2.alpha = 0.8;
  rect2.thickness = 0.02*outerRadius;
  rect2.topInPixels = -0.52*gauge.widthInPixels;
  clip3.addControl(rect2);
  infobox.angleArrow.addControl(clip3);
  gauge.addControl(infobox.angleArrow);

  infobox.tiltArrow = new Container();
  infobox.tiltArrow.widthInPixels = 2*innerRadius;
  infobox.tiltArrow.heightInPixels = 2*innerRadius;
  const clip4 = new Container();
  clip4.widthInPixels = 0.1*gauge.widthInPixels;
  clip4.heightInPixels = 0.5*gauge.widthInPixels;
  clip4.topInPixels = -0.4*gauge.widthInPixels;
  const rect3 = new Rectangle();
  rect3.widthInPixels = gauge.widthInPixels*0.33;
  rect3.heightInPixels = gauge.widthInPixels*0.33;
  rect3.rotation = Math.PI/4;
  rect3.background = "black";
  rect3.color = "black";
  rect3.alpha = 0.8;
  rect3.thickness = 0.02*outerRadius;
  rect3.topInPixels = -clip4.topInPixels;
  clip4.addControl(rect3);
  infobox.tiltArrow.addControl(clip4);
  gauge.addControl(infobox.tiltArrow);

  const mouseOverlay = new Container();
  mouseOverlay.widthInPixels = gauge.widthInPixels;
  mouseOverlay.heightInPixels = gauge.heightInPixels;
  const gaugeOnPointer = (vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/infobox.guiTexture.getScale();
    const angle = Math.atan2(xval, yval);
    if(radius < outerRadius && radius > middleRadius && yval > 0 && rect2.background == "black" && rect3.background == "black") {
      rect1.color = "lightgrey";
      rect2.color = "black";
      rect3.color = "black";
      infobox.speedArrow.rotation = angle;
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = gaugeToSpeed(angle).toString();
      if(rect1.background != "black") {
        ipcRenderer.send(infobox.name, "requestRotationSpeed", gaugeToSpeed(angle));
      }
    }
    else if (radius < middleRadius && radius > innerRadius && rect1.background == "black" && rect3.background == "black") {
      rect1.color = "black";
      rect2.color = "lightgrey";
      rect3.color = "black"
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = angle;
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = printDegree(gaugeToRotation(angle));
      if(rect2.background != "black"){
        ipcRenderer.send(infobox.name, "requestRotationAngle", gaugeToRotation(angle));
      }
    }
    else if (radius < innerRadius && rect1.background == "black" && rect2.background == "black") {
      rect1.color = "black";
      rect2.color = "black";
      rect3.color = "lightgrey";
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "lightgrey";
      infobox.infoText.text = printDegree(infobox.tiltValue);
      if(rect3.background != "black") {
        ipcRenderer.send(infobox.name, "requestSync");
      }
    }
    else if (rect1.background == "black" && rect2.background == "black" && rect3.background == "black") {
      rect1.color = "black";
      rect2.color = "black";
      rect3.color = "black";
      infobox.speedArrow.rotation = 0;
      infobox.angleArrow.rotation = rotationToGauge(infobox.rotationValue);
      infobox.infoText.color = "black";
      infobox.infoText.text = printDegree(infobox.rotationValue);
    }
  };
  mouseOverlay.onPointerMoveObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerOutObservable.add(gaugeOnPointer);
  mouseOverlay.onPointerDownObservable.add((vec) => {
    const xval = vec.x - mouseOverlay.centerX;
    const yval = -vec.y + mouseOverlay.centerY;
    const radius = Math.sqrt(xval**2 + yval**2)/infobox.guiTexture.getScale();
    if(radius < outerRadius && radius > middleRadius && yval > 0) {
      rect1.background = infobox.color;
    }
    else if (radius < middleRadius && radius > innerRadius) {
      rect2.background = infobox.color;
    }
    else if (radius < innerRadius) {
      rect3.background = infobox.color;
    }
    gaugeOnPointer(vec);
  });
  mouseOverlay.onPointerUpObservable.add((vec) => {
    if(rect1.background == infobox.color) {
      ipcRenderer.send(infobox.name, "requestRotationSpeed", 0);
    }
    rect1.background = "black";
    rect2.background = "black";
    rect3.background = "black";
    gaugeOnPointer(vec);
  });
  gauge.addControl(mouseOverlay);
  return gauge;
}
