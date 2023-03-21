const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error - '${e.message}'`);
    process.exit(1);
  }
};

initializeDBAndServer();

//Middleware function for Authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHead = request.headers.authorization;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get all states API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT state_id as stateId, state_name as stateName, population 
            FROM state`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//Get a state by Id API
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
            SELECT state_id as stateId, state_name as stateName, population
            FROM state WHERE state_id = ${stateId}`;
  const stateDetails = await db.get(getStateQuery);
  response.send(stateDetails);
});

//Add new district API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
           INSERT INTO
                district (district_name, state_id, cases, cured, active, deaths)
            VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths} )                
            `;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//Get a district by Id API
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
            SELECT district_id as districtId, district_name as districtName,
                    state_id as stateId, cases, cured, active, deaths                    
            FROM district WHERE district_id = ${districtId}
        `;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(districtDetails);
  }
);

//Delete district by Id API
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
            DELETE                    
            FROM district 
            WHERE district_id = ${districtId}
        `;
    await db.get(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update district details API
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
            UPDATE district
            SET
                district_name = '${districtName}',
                state_id = ${stateId},
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}                    
            WHERE district_id = ${districtId}
        `;
    await db.get(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//Get State's COVID stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `
            SELECT
                SUM(cases) as totalCases,
                SUM(cured) as totalCured,
                SUM(active) as totalActive,
                SUM(deaths) as totalDeaths
            FROM
                district
            WHERE
                state_id = ${stateId}                            
        `;
    const stateStats = await db.get(getStateStats);
    response.send(stateStats);
  }
);


module.exports = app;