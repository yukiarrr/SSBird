window.popupObject = {};

const initializeBackground = async () => {
  const isInitializing = await getBackgroundVariable("isInitializing");
  if (isInitializing) {
    await closeWithMessage("Wait initializing...");

    return;
  }

  callBackgroundFunction("initialize");
};

const initializeTab = () => {
  const tabContents = $(".tab-content>div");
  const tabButtons = $(".tab-buttons span");

  tabContents.hide();
  tabContents.first().slideDown();
  tabButtons.map((index, element) => {
    const tabButton = $(element);
    tabButton.click(() => {
      const tabButtonClass = tabButton.attr("class");
      $("#lamp").removeClass().addClass("#lamp").addClass(tabButtonClass);
      tabContents.map((index, element) => {
        const tabContent = $(element);
        if (tabContent.hasClass(tabButtonClass)) {
          tabContent.fadeIn(800);
        } else {
          tabContent.hide();
        }
      });
    });
  });
};

const initializeSelectizes = () => {
  if (matchMedia("(prefers-color-scheme: dark)").matches) {
    $("#selectize").attr("href", "css/selectize.dark.css");
  } else {
    $("#selectize").attr("href", "css/selectize.default.css");
  }

  const selectSelectizes = $(".select-selectize");
  selectSelectizes.hide();

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (tab.status !== "complete") {
      await closeWithMessage("Wait page loading...");

      return;
    }

    chrome.tabs.sendMessage(tab.id, "", async (response) => {
      if (!response || response.spreadsheets.length === 0) {
        await closeWithMessage("Reload page.");

        return;
      }

      selectSelectizes.show();

      const selectApplySpreadsheets = $("#select-apply-spreadsheets");
      selectApplySpreadsheets.append(
        response.spreadsheets.map((spreadsheet) =>
          $("<option>", {
            value: spreadsheet.id,
            text: spreadsheet.name,
            selected: false,
          })
        )
      );

      $("#select-base-sheet,#select-overlay-sheets").append(
        response.sheetNames.map((name) =>
          $("<option>", { value: name, text: name, selected: false })
        )
      );

      selectSelectizes.prop("selectedIndex", -1);

      const disableSelectApplySpreadsheets = response.spreadsheets.length === 1;
      if (disableSelectApplySpreadsheets) {
        selectApplySpreadsheets.prop("selectedIndex", 0);
      }

      popupObject.applySpreadsheetsSelectize = selectApplySpreadsheets.selectize(
        {
          plugins: ["remove_button"],
          maxItems: null,
          persist: false,
          create: (input) => {
            return {
              value: input,
              text: input,
            };
          },
        }
      )[0].selectize;

      if (disableSelectApplySpreadsheets) {
        popupObject.applySpreadsheetsSelectize.disable();
      }

      popupObject.baseSheetSelectize = $("#select-base-sheet").selectize({
        persist: false,
        create: (input) => {
          return {
            value: input,
            text: input,
          };
        },
      })[0].selectize;

      popupObject.overlaySheetsSelectize = $(
        "#select-overlay-sheets"
      ).selectize({
        plugins: ["remove_button"],
        maxItems: null,
        persist: false,
        create: (input) => {
          return {
            value: input,
            text: input,
          };
        },
      })[0].selectize;
    });
  });
};

const initializeButtons = async () => {
  const startLoading = (element, loadingText) => {
    $(element)
      .empty()
      .append(`<i class='fa fa-spinner fa-spin'></i> ${loadingText}`)
      .addClass("btn-progress");
  };

  const stopLoading = (element, defaultText) => {
    $(element).empty().removeClass("btn-progress").append(defaultText);
  };

  let isApplying = false;

  $("#btn-apply").click(async () => {
    if (isApplying) {
      return;
    }
    const isInitializing = await getBackgroundVariable("isInitializing");
    if (isInitializing) {
      await alertOnBackground("Wait initializing...");

      return;
    }
    const isInitialized = await getBackgroundVariable("isInitialized");
    if (!isInitialized) {
      await alertOnBackground("Failed initialize.\nInput config.");

      return;
    }
    if (popupObject.baseSheetSelectize.items.length === 0) {
      await alertOnBackground("Select base sheet.");

      return;
    }

    if (confirm("Apply?")) {
      startLoading("#btn-apply", "Applying");
      callBackgroundFunction("apply", {
        spreadsheetIds: popupObject.applySpreadsheetsSelectize.items,
        baseSheetName: popupObject.baseSheetSelectize.items[0],
        overlaySheetNames: popupObject.overlaySheetsSelectize.items,
        callback: () => {
          stopLoading("#btn-apply", "Apply");
          isApplying = false;
        },
      });
      isApplying = true;
    }
  });

  $("#btn-reset").click(() => {
    if (confirm("Reset?")) {
      callBackgroundFunction("reset");
      close();
      callBackgroundFunction("initialize");
    }
  });

  isApplying = await getBackgroundVariable("isApplying");
  if (isApplying) {
    startLoading("#btn-apply", "Applying");
  }
};

initializeBackground();
initializeTab();
initializeSelectizes();
initializeButtons();
