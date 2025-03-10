import { useState, useCallback, useEffect } from "react";
import { geminiModel } from "./firebase";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import toast, { Toaster } from "react-hot-toast";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
  InfoWindow,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { FaSun, FaMoon } from "react-icons/fa";

const containerStyle = {
  width: "100%",
  height: "600px",
};

const center = {
  lat: 15.496777,
  lng: 73.827827,
};

const currentMonth = new Date().getMonth();

function App() {
  const [mess, setmess] = useState("");
  const [place, setplace] = useState("");
  const [dest, setdest] = useState("");
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [Distance, setDistance] = useState(null);
  const [Duration, setDuration] = useState(null);
  const [placesOnRoute, setPlacesOnRoute] = useState([]);
  const [backendResponse, setBackendResponse] = useState([]);
  const [activeMarker, setActiveMarker] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [timeRange, setTimeRange] = useState(1); // Default to 1 month
  const [userLocationDefined, setuserLocationDefined] = useState(null);
  const [userLocationPlace, setUserLocationPlace] = useState(""); // Store the place name of user location
  const [test, settest] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle("dark-mode", !darkMode);
  };

  const reverseGeocodeLocation = (location) => {
    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ location }, (results, status) => {
      settest(results);
      if (status === "OK" && results[0]) {
        console.log("Geocoder results: ", results);
        setUserLocationPlace(results[0].formatted_address);
      } else {
        console.error("Geocoder failed due to: " + status);
      }
    });
  };

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyB2rs0uDLILULcxJmljxKGUBHh9uoY-Wt8",
    libraries: ["places"],
  });

  useEffect(() => {
    // Get the user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);

          reverseGeocodeLocation(location);
        },
        (error) => {
          console.error("Error getting user's location: ", error);
        }
      );
    }
  }, []);

  console.log("user is staying at", userLocationPlace);
  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(map) {
    const bounds = new window.google.maps.LatLngBounds(center);
    map.fitBounds(bounds);

    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  useEffect(() => {
    if (map && directionsResponse) {
      const routeBounds = directionsResponse.routes[0].bounds;
      const service = new window.google.maps.places.PlacesService(map);
      const request = {
        bounds: routeBounds,
        type: "tourist_attraction",
      };
      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setPlacesOnRoute(results);
        }
      });
    }
  }, [map, directionsResponse]);

  const filteredFestivals = backendResponse.filter((placeObj) => {
    if (placeObj.date && placeObj.date.seconds) {
      const eventDate = new Date(placeObj.date.seconds * 1000);
      const currentDate = new Date();
      const diffMonths =
        (eventDate.getFullYear() - currentDate.getFullYear()) * 12 +
        (eventDate.getMonth() - currentDate.getMonth());

      if (timeRange === "all") {
        return true;
      }
      return diffMonths <= timeRange;
    }
    return false;
  });
  //this call firestore function
  async function getDestinations(db) {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const response = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        response.push({
          ...data,
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
          name: doc.id,
        });
      });
      setBackendResponse(response);

      console.log("backendResponse", response);
      console.log("user loc", userLocation);
    } catch (e) {
      console.error("Error getting documents: ", e);
    }
  }

  async function run() {
    // alert("run is running", mess);
    toast.success("Successfully sent to the Vertex api");
    getDestinations(db);
    const prompt = `Extract the place (starting location) and destination (ending location) from the given text "${mess}" and return a JSON object in the following format:
{ 
  "place": "Ponda",
  "destination": "Sanguem"
}
If the place is not mentioned, return:
{ 
  "place": "Not", 
  "destination": "Sanguem"
}
Rules:
The "place" is where the user is currently located.
The "destination" is where the user wants to go.
If the place is missing, set "place": "Not".
Extract locations even from vague, informal sentences.`;
    const result = await geminiModel.generateContent(prompt);

    const response = result.response;
    const text = response.text();
    const txt = text.slice(7, -4);
    console.log(`trimmed text = ${txt}`);
    const obj = JSON.parse(txt);
    setplace(() => {
      return obj.place;
    });
    setdest(obj.destination);
    if (obj.place === "Not") {
      setplace(userLocationPlace);
    }
    console.log("place is finaaaaaaaaaaaaaaaaaaaaaaaal", place);
  }

  return (
    <div className="app-container">
      <div>
        <Toaster />
      </div>
      <button className="toggle-button" onClick={toggleDarkMode}>
        {darkMode ? <FaSun /> : <FaMoon />}
      </button>
      <div className="form-container">
        <form>
          <input
            className="input-field"
            type="text"
            placeholder="Where would you like to go?"
            onChange={(e) => setmess(e.target.value)}
          />
          <button
            className="submit-button"
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
          >
            Find Route
          </button>
        </form>
        <div className="filter-buttons">
          {[1, 2, 5, 10, "all"].map((range) => (
            <button
              key={range}
              className={`filter-button ${timeRange === range ? "active" : ""}`}
              onClick={() => setTimeRange(range)}
            >
              {range === "all"
                ? "All Events"
                : `${range} ${range === 1 ? "Month" : "Months"}`}
            </button>
          ))}
        </div>
      </div>

      <div className="info-container">
        <div className="info-text">
          <div>
            <span className="info-label">From:</span> {place || "Not selected"}
          </div>
          <div>
            <span className="info-label">To:</span> {dest || "Not selected"}
          </div>
          <div>
            <span className="info-label">Distance:</span>{" "}
            {Distance || "Not calculated"}
          </div>
          <div>
            <span className="info-label">Duration:</span>{" "}
            {Duration || "Not calculated"}
          </div>
        </div>
      </div>

      <button
        className="tap-button"
        onClick={async () => {
          console.log(`place = ${place} destination = ${dest}`);
          console.log(`the place and destination will be ${place}`);
          const directionsService = new google.maps.DirectionsService();
          const results = await directionsService.route({
            origin: place == "not" ? userLocation : `${place} goa`,
            destination: `${dest} goa`,

            travelMode: google.maps.TravelMode.DRIVING,
          });
          setDirectionsResponse(results);
          console.log("the respose is got", results);
          setDistance(results.routes[0].legs[0].distance.text);
          setDuration(results.routes[0].legs[0].duration.text);
        }}
      >
        Show Route
      </button>

      <div className="map-container">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={10}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            <Marker
              position={userLocation}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
            />

            {filteredFestivals.map((placeObj, idx) => (
              <Marker
                key={idx + 10000}
                onClick={() => console.log("clicked")}
                onMouseOver={() => setActiveMarker(idx + 10000)}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                  scaledSize: new window.google.maps.Size(40, 40),
                }}
                onMouseOut={() => setActiveMarker(null)}
                position={{
                  lat: parseFloat(placeObj.lat),
                  lng: parseFloat(placeObj.lng),
                }}
              >
                {activeMarker === idx + 10000 && (
                  <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                    <div className="info-window">
                      <img
                        src={placeObj.imageUrl || "default-image-url.jpg"}
                        alt={placeObj.name}
                        className="info-window-image"
                      />
                      <div className="info-window-text">
                        <h3>{placeObj.name}</h3>
                        <p>{placeObj.description}</p>
                        <div className="info-window-rating">
                          <span className="star">★</span>
                          <span>{placeObj.rating || "N/A"}</span>
                        </div>
                        <p>
                          Date:{" "}
                          {placeObj.date && (
                            <span>
                              {new Date(
                                placeObj.date.seconds * 1000
                              ).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            ))}

            {placesOnRoute.map((placeObj, idx) => (
              <Marker
                key={idx}
                onClick={() => console.log("clicked")}
                onMouseOver={() => setActiveMarker(idx)}
                onMouseOut={() => setActiveMarker(null)}
                position={placeObj.geometry.location}
              >
                {activeMarker === idx && (
                  <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                    <div className="info-window">
                      <img
                        src={
                          placeObj.photos && placeObj.photos.length > 0
                            ? placeObj.photos[0].getUrl()
                            : "default-image-url.jpg"
                        }
                        alt={placeObj.name}
                        className="info-window-image"
                      />
                      <div className="info-window-text">
                        <h3>{placeObj.name}</h3>
                        <div className="info-window-rating">
                          <span className="star">★</span>
                          <span>{placeObj.rating || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            ))}

            {directionsResponse && (
              <DirectionsRenderer directions={directionsResponse} />
            )}
          </GoogleMap>
        ) : (
          <>loading</>
        )}
      </div>
    </div>
  );
}

export default App;
