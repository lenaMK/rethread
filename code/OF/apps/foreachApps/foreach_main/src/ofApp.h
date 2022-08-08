#pragma once

#include "ofMain.h"
#include "ofxGui.h"
#include "ofxOsc.h"

// listening port
#define PORT 12345
#define SEND_PORT 12371

// This openFrameworks example is designed to demonstrate how to access the
// webcam.
//
// For more information regarding this example take a look at the README.md.
//

enum class State { IDLE, COUNTDOWN, TRANSITION, APPLY_FILTER, END_SCREEN };

static map<string, State> string_state_map;

class ofApp : public ofBaseApp {

public:
  void setup();
  void update();
  void draw();

  void keyPressed(int key);
  void keyReleased(int key);
  void mouseMoved(int x, int y);
  void mouseDragged(int x, int y, int button);
  void mousePressed(int x, int y, int button);
  void mouseReleased(int x, int y, int button);
  void mouseEntered(int x, int y);
  void mouseExited(int x, int y);
  void windowResized(int w, int h);
  void dragEvent(ofDragInfo dragInfo);
  void gotMessage(ofMessage msg);

  void transition_to_state(State new_state);

  State state = State::IDLE;

  ofVideoGrabber vidGrabber;
  ofPixels videoInverted;
  ofTexture videoTexture;
  int camWidth;
  int camHeight;
  ofImage staticImage;
  bool useStaticImage = false;

  ofShader pixelShader;
  ofShader filterShader;
  ofFbo imageFbo;         // the live or captured image
  ofFbo filteredImageFbo; // the live or captured image

  ofxPanel gui;
  ofParameter<float> pixelZoom;
  ofParameter<bool> showFeed;
  ofParameter<bool> showFilterShader;
  ofParameter<bool> showPixels;
  ofParameter<float> filterGain;
  ofParameter<float> filterExponent;

  ofTrueTypeFont numberFont;
  ofTrueTypeFont endScreenFont;

  struct {
    int num = -1;
    float size = 0;
  } countdownData;

  struct {
    float duration;
    float startTime;
    float zoom;
    float maxZoom = 10.0;
  } transitionData;

  struct {
    long pixelsProcessed = 0;
  } applyFilterData;

  ofxOscReceiver receiver;
  ofxOscSender sender;
  void checkOscMessages();
};
