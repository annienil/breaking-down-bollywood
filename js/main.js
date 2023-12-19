let scatterplotSelection = null,
  networkActorNodeSelection = null,
  scatterplot,
  network;
let moviesSelectedByGenre = [];

d3.csv("data/bollywood-full.csv")
  .then((dataFull) => {
    // Todo: Preprocess data and show chart
    dataFull.forEach((d) => {
      d.imdb_rating = +d.imdb_rating;
      d.imdb_votes = +d.imdb_votes;
      d.genres = d.genres.split("|");
      d.actors = d.actors.split("|");
      const { wins, nominations } = parseWinsNominations(d.wins_nominations);
      d.wins = wins;
      d.nominations = nominations;
    });

    // establish layout parameters
    this.networkWidth = 600;
    this.networkHeight = 600;
    this.scatterplotWidth = window.innerWidth - 40;
    this.scatterplotHeight = 560;

    d3.csv("data/bollywood-crew.csv").then((dataCrew) => {
      dataCrew = dataCrew.filter((d) => d.known_for !== "\\N");

      dataCrew.forEach((d) => {
        d.known_for = d.known_for.split("|");
        d.profession = d.profession.split("|");
      });

      d3.csv("data/collaborations.csv").then((dataActors) => {
        dataActors.forEach((d) => {
          d.count = +d.count;
          d.genres = d.genres.replaceAll("', '", "|");
          d.genres = d.genres.replaceAll("['", "");
          d.genres = d.genres.replaceAll("']", "");
          d.genres = d.genres.split("|");
        });

        // filter to people with >= 10 collabs (aka truly the most common collaborations)
        dataActors = dataActors.filter((d) => d.count >= 13);
        // const network = new Network();
        network = new Network(
          {
            parentElement: "#network",
            networkWidth: this.networkWidth,
            networkHeight: this.networkHeight,
          },
          dataActors,
          dataCrew,
          dataFull
        );
        network.updateVis();
      });

      scatterplot = new Scatterplot(
        {
          parentElement: "#scatterplot",
          scatterplotWidth: this.scatterplotWidth,
          scatterplotHeight: this.scatterplotHeight,
        },
        dataFull,
        dataCrew
      );

      scatterplot.updateVis();

    });
  })
  .catch((error) => console.error(error));

function parseWinsNominations(str) {
  const result = { wins: 0, nominations: 0 };

  // Check if the string is not empty
  if (str.trim() !== "") {
    // Extract wins and nominations using regular expressions
    const winsMatch = str.match(/(\d+)\s*win/);
    const nominationsMatch = str.match(/(\d+)\s*nominations?/);

    // Update result object if matches are found
    if (winsMatch) {
      result.wins = parseInt(winsMatch[1], 10);
    }

    if (nominationsMatch) {
      result.nominations = parseInt(nominationsMatch[1], 10);
    }
  }

  return result;
}

function updateGlobalActorSelection(actor) {
  scatterplotSelection = scatterplotSelection === actor ? null : actor;
  scatterplot.updateRender(scatterplotSelection);

  networkActorNodeSelection =
    networkActorNodeSelection === actor ? null : actor;
  network.renderNetwork(networkActorNodeSelection);
}
