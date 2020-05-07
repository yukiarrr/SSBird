chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const url = location.href;
  let spreadsheets = [];
  let sheetNames = [];

  try {
    if (url.startsWith("https://docs.google.com/spreadsheets/d/")) {
      const matches = url.match(/d\/(.+)\/edit#gid=/);
      if (matches.length > 1) {
        spreadsheets.push({
          id: matches[1],
          name: $("#docs-title-input-label-inner").text(),
        });
      }
    } else {
      spreadsheets = $("div[data-id]")
        .map((index, element) => {
          const divSpreadsheet = $(element);
          return {
            id: divSpreadsheet.attr("data-id"),
            name: divSpreadsheet.find("div[data-column-field='6']").text(),
          };
        })
        .get();
    }

    sheetNames = $(".docs-sheet-tab-name")
      .map((index, element) => {
        return $(element).text();
      })
      .get();
  } catch {}

  sendResponse({
    spreadsheets: spreadsheets,
    sheetNames: sheetNames,
  });
});
