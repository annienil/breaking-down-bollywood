class ActorStackedBarChart {
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 1200,
      containerHeight: 560,
      margin: {
        top: 30,
        right: 5,
        bottom: 200,
        left: 30,
      },
      tooltipPadding: _config.tooltipPadding || 15,
    };

    this.actorMovieData = null;
    this.initVis();
  }

  initVis() {
    let vis = this;
    vis.config.width =
      vis.config.containerWidth -
      vis.config.margin.left -
      vis.config.margin.right;
    vis.config.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("id", "barchart")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left}, 100)`);

    // Inside initVis method
    vis.container = vis.chart
      .append("g")
      .attr("class", "chart-container")
      .attr("transform", `translate(0, 0)`);

    vis.container
      .append("rect")
      .attr("class", "chart-border")
      .attr("width", vis.config.width)
      .attr("height", vis.config.height)
      .style("fill", "none")
      .style("stroke", "black")
      .style("stroke-dasharray", "5,5");

    vis.container
      .append("text")
      .attr("class", "no-selection-text")
      .attr("x", vis.config.width / 2)
      .attr("y", vis.config.height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .text(
        "Select an actor from the scatterplot to see their award distributions"
      );
  }

  updateVis(actorMovieData) {
    const vis = this;

    vis.clearScreen();

    if (!actorMovieData) {
      vis.container
        .append("text")
        .attr("class", "no-selection-text")
        .attr("x", vis.config.width / 2)
        .attr("y", vis.config.height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .text(
          "Select an actor from the scatterplot to see their award distributions"
        );
      return;
    }

    vis.actorMovieData = actorMovieData.movies.map((m) => ({
      title: m.original_title,
      wins: m.wins,
      nominations: m.nominations,
    }));

    vis.xAxisG = vis.container
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.config.height + 5})`);

    vis.yAxisG = vis.container.append("g").attr("class", "axis y-axis");

    vis.xScale = d3
      .scaleBand()
      .domain(actorMovieData.movies.map((m) => m.original_title))
      .range([10, vis.config.width - 10])
      .paddingInner(0.1);

    vis.yScale = d3
      .scaleLinear()
      .domain([0, d3.max(actorMovieData.movies, (d) => d.wins + d.nominations)])
      .range([vis.config.height, 10]);

    vis.xAxis = d3.axisBottom(vis.xScale).tickSize(0);

    vis.yAxis = d3
      .axisLeft(vis.yScale)
      .ticks(6)
      .tickFormat(d3.format(".0f"))
      .tickSize(0);

    // update chart title
    vis.container.select(".chart-title").remove();
    vis.container
      .append("text")
      .attr("class", "chart-title")
      .attr("x", vis.config.width / 2)
      .attr("y", -vis.config.margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text(`Wins and Nominations for ${actorMovieData.name}`);

    vis.stack = d3.stack().keys(["wins", "nominations"]);

    vis.stackedData = vis.stack(vis.actorMovieData);

    vis.colorScale = d3
      .scaleOrdinal()
      .domain("wins", "nominations")
      .range(["#98abc5", "#8a89a6"]);

    vis.renderVis();
  }

  renderVis() {
    const vis = this;

    vis.container
      .selectAll(".stacked-bar")
      .data(vis.stackedData)
      .join("g")
      .attr("fill", (d) => vis.colorScale(d.key))
      .attr("class", (d) => `stacked-bar movie-${d.key}`)
      .selectAll("rect")
      .data((d) => d)
      .join("rect")
      .attr("x", (d) => vis.xScale(d.data.title))
      .attr("y", (d) => vis.yScale(d[1]))
      .attr("height", (d) => vis.yScale(d[0]) - vis.yScale(d[1]))
      .attr("width", vis.xScale.bandwidth());

    // Create a group for the tooltip
    const tooltipGroup = vis.container
      .append("g")
      .attr("class", "tooltip-group");

    // Add tooltips to each stacked bar
    tooltipGroup
      .selectAll(".tooltip-container")
      .data(vis.stackedData)
      .join("g")
      .attr("class", (d) => `tooltip-container movie-${d.key}`)
      .selectAll("rect")
      .data((d) => d)
      .join("rect")
      .attr("x", (d) => vis.xScale(d.data.title))
      .attr("y", (d) => vis.yScale(d[1]))
      .attr("height", (d) => vis.yScale(d[0]) - vis.yScale(d[1]))
      .attr("width", vis.xScale.bandwidth())
      .attr("fill", "transparent") // Make the rectangles transparent
      .on("mouseover", function (event, d) {
        const movie = vis.actorMovieData.find((m) => m.title === d.data.title);
        if (movie && d[1] - d[0] > 0) {
          const tooltipText =
            movie.wins === d[1]
              ? `${movie.wins} Wins`
              : `${movie.nominations} Nominations`;
          d3.select("#tooltip")
            .style("display", "block")
            .style("left", event.pageX + vis.config.tooltipPadding + "px")
            .style("top", event.pageY + vis.config.tooltipPadding + "px")
            .html(
              `<div class="tooltip-title">${d.data.title}</div><div><i>${tooltipText}</i></div>`
            );
        }
      })
      .on("mouseout", function () {
        d3.select("#tooltip").style("display", "none");
      });

    vis.xAxisG
      .call(vis.xAxis)
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-90)")
      .style("font-size", "small");

    vis.yAxisG.call(vis.yAxis).call((g) => g.select(".domain").remove());
  }

  clearScreen() {
    const vis = this;
    vis.container.selectAll("*").remove();
    vis.container
      .append("rect")
      .attr("class", "chart-border")
      .attr("width", vis.config.width)
      .attr("height", vis.config.height)
      .style("fill", "none")
      .style("stroke", "black")
      .style("stroke-dasharray", "5,5");
  }
}
