class Scatterplot {
  constructor(_config, _dataFull, _dataCrew) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: window.innerWidth - 40,
      containerHeight: 560,
      scatterplotWidth: _config.scatterplotWidth,
      scatterplotHeight: _config.scatterplotHeight,
      margin: {
        top: 50,
        right: 15,
        bottom: 20,
        left: 50,
      },
      tooltipPadding: _config.tooltipPadding || 15,
    };

    this.selectedFilter = null;

    this.dataFull = _dataFull;
    this.dataCrew = _dataCrew;
    this.barchart = new ActorStackedBarChart({
      parentElement: "#barchart",
    });
    this.heatmapSelectedActors = [];
    this.isAtleastOneHeatmapGenreSelected = false;
    this.initVis();
  }

  initVis() {
    let vis = this;

    vis.config.height =
      vis.config.scatterplotHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;
    vis.config.width =
      vis.config.scatterplotWidth -
      vis.config.margin.left -
      vis.config.margin.right;

    // Extract unique initials from actor names for x-axis

    vis.movieWithAtLeastOneNomination = vis.dataFull.filter(
      (m) => m.wins + m.nominations > 0
    );

    const actorInitials = [
      ...new Set(
        vis.movieWithAtLeastOneNomination
          .flatMap((d) =>
            d.actors.map((actor) => actor.charAt(0).toUpperCase())
          )
          .filter(Boolean)
      ),
    ].sort();

    vis.actors = [
      ...new Set(vis.movieWithAtLeastOneNomination.flatMap((d) => d.actors)),
    ]
      .filter(Boolean)
      .sort();

    vis.actorMap = {};

    for (const actor of vis.actors) {
      vis.actorMap[actor] = {
        wins: 0,
        nominations: 0,
        movies: [],
        name: actor,
      };

      for (const movie of vis.movieWithAtLeastOneNomination) {
        if (movie.actors.includes(actor)) {
          vis.actorMap[actor].movies.push(movie);
        }
      }

      vis.actorMap[actor].wins = vis.actorMap[actor].movies.reduce(
        (prev, curr) => prev + curr.wins,
        0
      );

      vis.actorMap[actor].nominations = vis.actorMap[actor].movies.reduce(
        (prev, curr) => prev + curr.nominations,
        0
      );
    }

    vis.minWinsNominations = 1;

    vis.maxWinsNominations = d3.max(
      vis.actors,
      (d) => vis.actorMap[d].wins + vis.actorMap[d].nominations
    );

    vis.xScale = d3
      .scaleBand()
      .domain(actorInitials)
      .range([30, vis.config.width - 30])
      .paddingInner(1);

    vis.yScale = vis.getYScaleAndAxisForFilter()[0];

    vis.xAxis = d3.axisBottom(vis.xScale).tickSize(0);

    vis.yAxis = vis.getYScaleAndAxisForFilter()[1];

    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("id", "scatterplot")
      .attr("width", vis.config.scatterplotWidth)
      .attr("height", vis.config.scatterplotHeight)
      .on("click", function (event, d) {
        updateGlobalActorSelection(null);
      });

    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left},0)`
      );

    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.config.height + 15})`);

    vis.yAxisG = vis.chart.append("g").attr("class", "axis y-axis");

    vis.svg
      .append("text")
      .attr("class", "axis-title")
      .attr("x", 10)
      .attr("y", 15)
      .text("Award Wins + Nominations");

    d3.select("#filterDropdown").on("change", function () {
      const selectedCategory = this.value;
      vis.filterDataByCategory(selectedCategory);
    });
  }

  updateVis(filteredActors, values) {
    let vis = this;

    vis.yAxisG.remove();

    vis.filteredActors = filteredActors || vis.actors;

    // re draw y axis with potentially updated scale
    vis.yScale = vis.getYScaleAndAxisForFilter(values)[0];
    vis.yAxis = vis.getYScaleAndAxisForFilter(values)[1];
    vis.yAxisG = vis.chart.append("g").attr("class", "axis y-axis");

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    const circles = vis.chart
      .selectAll(".scatter-point")
      .data(vis.isAtleastOneHeatmapGenreSelected ? vis.filteredActors.filter(a => vis.heatmapSelectedActors.includes(a)) : vis.filteredActors)
      .join("circle")
      .attr("class", (d) => {
        return `scatter-point ${
          d === scatterplotSelection
            ? "scatter-point-selected"
            : "scatter-point-active"
        }`;
      })
      .attr("id", (d) => `circle-${d}`)
      .attr("r", 5)
      .attr("cx", (d) => {
        const xPos = vis.xScale(d.charAt(0).toUpperCase());
        const jitter = (Math.random() - 0.5) * 40;
        return xPos + jitter;
      })
      .attr("cy", (d) =>
        vis.yScale(vis.actorMap[d].wins + vis.actorMap[d].nominations)
      );

    circles
      .on("mouseover", function (event, d) {
        d3
          .select("#tooltip")
          .style("display", "block")
          .style("left", event.pageX + vis.config.tooltipPadding + "px")
          .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
            <div class="tooltip-title">${d}</div>
            <div><i>Wins:${vis.actorMap[d].wins}</i></div>
            <div><i>Nominations:${vis.actorMap[d].nominations}</i></div>
        `);
      })
      .on("mouseleave", function (event, d) {
        d3.select("#tooltip").style("display", "none");
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        updateGlobalActorSelection(d);

        d3.select("#tooltip").style("display", "none");
      });

    vis.xAxisG.call(vis.xAxis).call((g) => g.select(".domain").remove());
    vis.yAxisG.call(vis.yAxis).call((g) => g.select(".domain").remove());
  }

  filterDataByCategory(category) {
    let vis = this;

    vis.selectedFilter = category;

    const filteredData = vis.actors.filter((d) => {
      const actorData = vis.actorMap[d] || {};
      const winsNoms = actorData.wins + actorData.nominations;
      switch (category) {
        case "1-10":
          return winsNoms >= 1 && winsNoms <= 10;
        case "11-20":
          return winsNoms >= 11 && winsNoms <= 20;
        case "21-50":
          return winsNoms >= 21 && winsNoms <= 50;
        case "51-100":
          return winsNoms >= 51 && winsNoms <= 100;
        case "101-300":
          return winsNoms >= 101 && winsNoms <= 300;
        case "300+":
          return winsNoms > 300;
        default:
          return true;
      }
    });

    vis.updateVis(filteredData, category);
  }

  getYScaleAndAxisForFilter(values = "") {
    let vis = this;
    if (!values) {
      values = ""
    }
    const min = values.split("-")[0];
    const max = values.split("-")[1];

    switch (vis.selectedFilter) {
      case null:
      case "-1": {
        const yScale = d3
          .scaleLog()
          .domain([vis.minWinsNominations, vis.maxWinsNominations])
          .range([vis.config.height, 20]);
        const yAxis = d3
          .axisLeft(yScale)
          .tickValues([1, 2, 4, 10, 25, 100, 1000])
          .tickFormat(d3.format(".0f"))
          .tickSize(0);
        return [yScale, yAxis];
      }
      case "300+": {
        const yScale = d3
          .scaleLinear()
          .domain([300, vis.maxWinsNominations])
          .range([vis.config.height, 20]);
        const yAxis = d3
          .axisLeft(yScale)
          .ticks(6)
          .tickFormat(d3.format(".0f"))
          .tickSize(0);
        return [yScale, yAxis];
      }
      default: {
        const yScale = d3
          .scaleLinear()
          .domain([min, max])
          .range([vis.config.height, 20]);
        const yAxis = d3
          .axisLeft(yScale)
          .ticks(6)
          .tickFormat(d3.format(".0f"))
          .tickSize(0);
        return [yScale, yAxis];
      }
    }
  }

  updateRender(actor) {
    const vis = this;
    vis.toggleCircleClass();
    vis.barchart.updateVis(vis.actorMap[actor]);
  }

  toggleCircleClass() {
    const vis = this;
    vis.chart
      .selectAll(".scatter-point")
      .attr(
        "class",
        (d) =>
          `scatter-point ${
            d === scatterplotSelection
              ? "scatter-point-selected"
              : "scatter-point-active"
          }`
      );
  }

  updateHeatmapActors(actorList) {
    const vis = this;
    vis.heatmapSelectedActors = actorList;
    vis.updateVis(vis.filteredActors, vis.selectedFilter)
  }

}
