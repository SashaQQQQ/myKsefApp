const axios = require("axios");

function createKsefClient(sessionToken, baseUrl) {
  console.log("=================================");
  console.log("CREATE KSEF CLIENT");
  console.log("=================================");

  console.log("SESSION TOKEN");
  console.log(sessionToken);

  const client = axios.create({
    baseURL: baseUrl,

    timeout: 30000,

    headers: {
      Authorization: `Bearer ${sessionToken}`,

      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((req) => {
    console.log("=================================");
    console.log("REQUEST");
    console.log("=================================");

    if (req.data) {
      console.log("body");
      console.log(JSON.stringify(req.data, null, 2));
    }

    return req;
  });

  client.interceptors.response.use(
    (response) => {
      console.log("=================================");
      console.log("RESPONSE");
      console.log("=================================");

      console.log("status", response.status);

      console.log("body");
      console.log(JSON.stringify(response.data, null, 2));

      return response;
    },

    (error) => {
      console.log("=================================");
      console.log("RESPONSE ERROR");
      console.log("=================================");

      if (error.response) {
        console.log("status", error.response.status);

        console.log("data");
        console.log(JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(error.message);
      }

      return Promise.reject(error);
    },
  );

  return client;
}

module.exports = {
  createKsefClient,
};
