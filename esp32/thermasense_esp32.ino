#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <DHT.h>
#include <EEPROM.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>  // needed for TLS certificate validation

#define DHTPIN 4
#define DHTTYPE DHT22
#define BUZZER_PIN 2
#define RED_PIN 15
#define GREEN_PIN 13
#define BLUE_PIN 12

#define OFFSET_ADDR 0
#define SCALE_ADDR sizeof(float)

// --- WiFi & Cloud Settings ---
const char* ssid = "Converge_2.4GHz_AFQH6Z";
const char* password = "9bStEc4t";

// LOCAL backend (when your PC is running `npm run server`)
// PC IP: 192.168.1.12 — change if your PC's IP changes (run ipconfig to check)
const char* localServerUrl = "http://192.168.1.12:3000/api/telemetry";

// -----------------------------------------------------------------------------
// LOCAL backend (use when your PC is running `npm run server`)
// PC IP: 192.168.1.12 — change if your PC's IP changes (run ipconfig to check)
const char* localServerUrl = "http://192.168.1.12:3000/api/telemetry";

// -----------------------------------------------------------------------------
// CLOUD backend – Firebase Realtime Database REST URL (or Cloud Function)
// Use the Firebase project ID from your web config (below) to construct this.
// If your database rules require authentication append `?auth=<DATABASE_SECRET>`
// or supply an OAuth token from a Cloud Function instead.
//
// provided web config for reference:
//   apiKey: "AIzaSyBNzDU4RDh51dfP1dFXwxwSewKfV2nutE8",
//   authDomain: "therma-sense-206b4.firebaseapp.com",
//   projectId: "therma-sense-206b4",
//   storageBucket: "therma-sense-206b4.firebasestorage.app",
//   messagingSenderId: "43677757300",
//   appId: "1:43677757300:web:263caeda5a4c7ddb818621",
//   measurementId: "G-TF6CH6HV8F"

const char* firebaseProjectId = "therma-sense-206b4";
// typical database URL forms (check your console):
//   https://therma-sense-206b4-default-rtdb.firebaseio.com
//   https://therma-sense-206b4.firebaseio.com
// The console often shows the '-default-rtdb' host for newer projects.
// database secret for unauthenticated write access (provided by you)
const char* databaseSecret = "lJZpD2eWpRfUs7NEnEnxEZnPE27UFn4rl24sZoTd";
// Use the '-default-rtdb' host form which is commonly required.
const char* cloudServerUrl =
  "https://therma-sense-206b4-default-rtdb.firebaseio.com/telemetry.json?auth=lJZpD2eWpRfUs7NEnEnxEZnPE27UFn4rl24sZoTd";

// -----------------------------------------------------------------------------

// false = send to PC (localServerUrl). true = send to cloud (cloudServerUrl)
// the firmware ships targeting the cloud; set to false if you need to debug
// against your local PC server.  You could also toggle this via GPIO/serial.
bool useCloud = true;  // switch off for localhost testing


unsigned long lastCloudPost = 0;
const unsigned long cloudInterval = 5000; // Send to cloud every 5 seconds
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
DHT dht(DHTPIN, DHTTYPE);

// Humidity Fix
float humidityOffset = -35.00; 
float humidityScale = 0.90;

float computeHeatIndex(float t, float h) {
  if (isnan(t) || isnan(h)) return NAN;
  float T = (t * 9.0/5.0) + 32.0; 
  float HI = -42.379 + 2.04901523*T + 10.14333127*h
             - 0.22475541*T*h - 0.00683783*T*T
             - 0.05481717*h*h + 0.00122874*T*T*h
             + 0.00085282*T*h*h - 0.00000199*T*T*h*h;
  return (HI - 32.0) * 5.0/9.0;
}

void setup() {
  WiFi.mode(WIFI_STA);
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  dht.begin();
  u8g2.begin();
  EEPROM.begin(512);

  // load humidity fix from EEPROM; if it has garbage, you may want to write defaults once
  EEPROM.get(OFFSET_ADDR, humidityOffset);
  EEPROM.get(SCALE_ADDR, humidityScale);
  // if you want to reset to default on each boot, uncomment the lines below:
  //humidityOffset = -35.00;
  //humidityScale = 0.90;
  //EEPROM.put(OFFSET_ADDR, humidityOffset);
  //EEPROM.put(SCALE_ADDR, humidityScale);
  //EEPROM.commit();

  // Connect to WiFi
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0, 20, "Connecting WiFi...");
  u8g2.sendBuffer();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  // set system time so HTTPS certificates validate
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("Time synchronized: " + String(time(nullptr)));
}

void loop() {
  // if wifi drops, try to get back on the network
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnect");
    WiFi.reconnect();
  }

  float t = dht.readTemperature();
  float h_raw = dht.readHumidity();
  float h = h_raw;

  if (!isnan(h)) {
    h = (h_raw + humidityOffset) * humidityScale;
    if (h > 200.0) h = 200.0;
    if (h < 0.0) h = 0.0;
  }

  // --- OLED DRAWING ---
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0,10,"THERMO SYSTEM");

  u8g2.setFont(u8g2_font_ncenB10_tr);
  char t_str[10]; dtostrf(t, 4, 1, t_str);
  u8g2.drawStr(0, 25, "T:"); u8g2.drawStr(30, 25, t_str); u8g2.drawStr(85, 25, "C");

  char h_str[10]; dtostrf(h, 4, 1, h_str);
  u8g2.drawStr(0, 40, "H:"); u8g2.drawStr(30, 40, h_str); u8g2.drawStr(85, 40, "%");

  float hi = computeHeatIndex(t, h);
  char hi_str[10]; dtostrf(hi, 4, 1, hi_str);
  u8g2.drawStr(0, 55, "HI:"); u8g2.drawStr(30, 55, hi_str); u8g2.drawStr(85, 55, "C");

  // --- WARNING LOGIC ---
  u8g2.setFont(u8g2_font_6x10_tf); 
  
  if (isnan(hi)) {
    u8g2.drawStr(0, 64, "Status: SENSOR ERROR");
  } else if (hi < 32.0) {
    u8g2.drawStr(0, 64, "Status: GOOD");
    if (t < 40.0) { digitalWrite(RED_PIN, LOW); digitalWrite(GREEN_PIN, HIGH); }
  } else if (hi >= 32.0 && hi < 40.0) {
    u8g2.drawStr(0, 64, "Status: CAUTION/WARM");
    if (t < 40.0) { digitalWrite(RED_PIN, HIGH); digitalWrite(GREEN_PIN, HIGH); }
  } else if (hi >= 40.0 && hi <= 51.0) {
    u8g2.drawStr(0, 64, "Status: DANGER");
    digitalWrite(RED_PIN, HIGH);
    digitalWrite(GREEN_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
  } else {
    u8g2.drawStr(0, 64, "Status: EXTREME DANGER");
    digitalWrite(RED_PIN, HIGH); digitalWrite(BLUE_PIN, HIGH);
  }

  u8g2.sendBuffer();

  // --- CLOUD POST LOGIC ---
  // Only send every 5 seconds, and only if sensor is working
  if (millis() - lastCloudPost >= cloudInterval) {
    lastCloudPost = millis();

    if (isnan(t) || isnan(h)) {
      Serial.println("Skip send: sensor read failed (NaN). Check DHT wiring.");
    } else if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Skip send: WiFi disconnected.");
    } else {
      const char* targetUrl = useCloud ? cloudServerUrl : localServerUrl;
      bool isHttps = (strncmp(targetUrl, "https", 5) == 0);

      Serial.print("Target URL: "); Serial.println(targetUrl);
      Serial.print("WiFi status: "); Serial.println(WiFi.status());
      Serial.print("Sending… T=");
      Serial.print(t);
      Serial.print(" H=");
      Serial.println(h);
      if (isHttps) Serial.println("Using HTTPS (secure client)"); else Serial.println("Using HTTP");

      // Reuse one client to avoid crash when connection fails (EXCVADDR 0x0)
      static WiFiClient wifiClient;
      static WiFiClientSecure wifiClientSecure;
      HTTPClient http;
      int httpResponseCode = -1;

      if (isHttps) {
        wifiClientSecure.setInsecure();
        http.begin(wifiClientSecure, targetUrl);
      } else {
        http.begin(wifiClient, targetUrl);
      }

      http.addHeader("Content-Type", "application/json");
      http.setConnectTimeout(3000);
      http.setTimeout(3000);

      StaticJsonDocument<200> doc;
      doc["temp"] = t;
      doc["humidity"] = h;

      String requestBody;
      serializeJson(doc, requestBody);

      Serial.println("POST start...");
      Serial.flush();
      yield();
      httpResponseCode = http.POST(requestBody);
      Serial.print("POST done. HTTP Code: ");
      Serial.println(httpResponseCode);
      String resp = "";
      if (httpResponseCode > 0) {
        resp = http.getString();
        Serial.print("Response body: "); Serial.println(resp);
      }

      // If Firebase suggests a correctUrl, parse it and retry the POST once
      if (httpResponseCode == 404 && resp.length() > 0) {
        Serial.println("Received 404 from Firebase; checking for suggested correctUrl...");
        StaticJsonDocument<256> jdoc;
        DeserializationError derr = deserializeJson(jdoc, resp);
        if (!derr && jdoc.containsKey("correctUrl")) {
          const char* correct = jdoc["correctUrl"];
          Serial.print("Firebase suggests correct host: "); Serial.println(correct);
          String correctedUrl = String(correct) + "/telemetry.json?auth=" + String(databaseSecret);
          Serial.print("Retrying POST with corrected URL: "); Serial.println(correctedUrl);

          // cleanup previous client
          http.end();

          // perform a single retry using corrected URL
          HTTPClient http2;
          if (strncmp(correctedUrl.c_str(), "https", 5) == 0) {
            wifiClientSecure.setInsecure();
            http2.begin(wifiClientSecure, correctedUrl.c_str());
          } else {
            http2.begin(wifiClient, correctedUrl.c_str());
          }
          http2.addHeader("Content-Type", "application/json");
          http2.setConnectTimeout(3000);
          http2.setTimeout(3000);
          int code2 = http2.POST(requestBody);
          Serial.print("Retry POST done. HTTP Code: "); Serial.println(code2);
          if (code2 > 0) {
            String resp2 = http2.getString();
            Serial.print("Retry response: "); Serial.println(resp2);
          }
          if (code2 == 200 || code2 == 201) {
            Serial.println("Retry successful. Consider persisting corrected URL to EEPROM.");
          } else {
            Serial.println("Retry failed: check auth, DB rules, or network.");
          }
          http2.end();
        } else {
          Serial.println("No valid 'correctUrl' in Firebase response or JSON parse failed.");
          Serial.println("Check that Realtime Database is enabled and the URL is correct.");
          http.end();
        }
      } else if (httpResponseCode != 200 && httpResponseCode != 201) {
        Serial.println("POST failed: check network, URL, auth (database secret), or DB rules.");
        http.end();
      } else {
        http.end();
      }
    }
  }

  // DHT22 needs at least 2 seconds between reads.
  // 2500ms gives a safe buffer so it doesn't lock up.
  delay(2500); 
}
