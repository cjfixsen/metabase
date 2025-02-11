import userEvent from "@testing-library/user-event";
import { waitFor } from "@testing-library/react";
import { getIcon, renderWithProviders, screen } from "__support__/ui";
import {
  createOrdersIdDatasetColumn,
  createOrdersProductIdDatasetColumn,
  createOrdersQuantityDatasetColumn,
  createOrdersTableDatasetColumns,
  createOrdersTotalDatasetColumn,
  createOrdersUserIdDatasetColumn,
  ORDERS,
  ORDERS_ID,
  SAMPLE_DB_ID,
} from "metabase-types/api/mocks/presets";
import { ClickActionsPopover } from "metabase/visualizations/components/ClickActions/ClickActionsPopover";
import type { RegularClickAction } from "metabase/visualizations/types";
import { getMode } from "metabase/visualizations/click-actions/lib/modes";
import { checkNotNull } from "metabase/core/utils/types";
import registerVisualizations from "metabase/visualizations/register";
import type { DatasetQuery, Series } from "metabase-types/api";
import { POPOVER_TEST_ID } from "metabase/visualizations/click-actions/actions/ColumnFormattingAction/ColumnFormattingAction";
import { createMockSingleSeries } from "metabase-types/api/mocks";
import type { ClickObject } from "metabase-lib/queries/drills/types";
import { SAMPLE_METADATA } from "metabase-lib/test-helpers";
import Question from "metabase-lib/Question";
import type StructuredQuery from "metabase-lib/queries/StructuredQuery";
import type Dimension from "metabase-lib/Dimension";

registerVisualizations();

const ORDERS_COLUMNS = createOrdersTableDatasetColumns();

describe("ClickActionsPopover", function () {
  describe("apply click actions", () => {
    describe("ColumnFormattingAction", () => {
      it("should apply column formatting to default ORDERS question on header click", async () => {
        const { props } = await setup();

        const gearIconButton = getIcon("gear");
        expect(gearIconButton).toBeInTheDocument();

        userEvent.click(gearIconButton);

        expect(screen.getByTestId(POPOVER_TEST_ID)).toBeInTheDocument();

        userEvent.type(screen.getByLabelText("Column title"), " NEW NAME");
        userEvent.tab(); // blur field

        expect(props.onUpdateVisualizationSettings).toHaveBeenCalledTimes(1);
        expect(props.onUpdateVisualizationSettings).toHaveBeenLastCalledWith({
          column_settings: {
            [`["ref",["field",${ORDERS.ID},null]]`]: {
              column_title: "ID NEW NAME",
            },
          },
        });
      });
    });

    describe("ColumnFilterDrill", () => {
      it("should apply ColumnFilterDrill to default ORDERS question on header click", async () => {
        const filterValue = 10;
        const { props } = await setup();

        const filterDrill = screen.getByText("Filter by this column");
        expect(filterDrill).toBeInTheDocument();

        userEvent.click(filterDrill);

        const filterField = screen.getByPlaceholderText("Enter an ID");
        expect(filterField).toBeInTheDocument();

        userEvent.type(filterField, filterValue.toString());
        userEvent.click(screen.getByText("Add filter"));

        expect(props.onChangeCardAndRun).toHaveBeenCalledTimes(1);
        expect(props.onChangeCardAndRun).toHaveBeenLastCalledWith({
          nextCard: expect.objectContaining({
            dataset_query: {
              database: SAMPLE_DB_ID,
              query: {
                filter: ["=", ["field", ORDERS.ID, null], filterValue],
                "source-table": ORDERS_ID,
              },
              type: "query",
            },
            display: "table",
          }),
        });
      });
    });

    describe("SortDrill", () => {
      it("should apply SortDrill to default ORDERS question on header click", async () => {
        const { props } = await setup();

        const sortDesc = getIcon("arrow_down");
        expect(sortDesc).toBeInTheDocument();

        userEvent.click(sortDesc);

        expect(props.onChangeCardAndRun).toHaveBeenCalledTimes(1);
        expect(props.onChangeCardAndRun).toHaveBeenLastCalledWith({
          nextCard: expect.objectContaining({
            dataset_query: {
              database: SAMPLE_DB_ID,
              query: {
                "order-by": [["desc", ["field", ORDERS.ID, null]]],
                "source-table": ORDERS_ID,
              },
              type: "query",
            },
            display: "table",
          }),
        });
      });
    });

    describe("SummarizeColumnByTimeDrill", () => {
      it.each([
        {
          column: createOrdersTotalDatasetColumn(),
          expectedCard: {
            dataset_query: getSummarizedOverTimeResultDatasetQuery(
              ORDERS.TOTAL,
              "type/Float",
            ),
            display: "table",
          },
        },
        {
          column: createOrdersQuantityDatasetColumn(),
          expectedCard: {
            dataset_query: getSummarizedOverTimeResultDatasetQuery(
              ORDERS.QUANTITY,
              "type/Integer",
            ),
            display: "table",
          },
        },
      ])(
        "should apply drill to default ORDERS question on header click",
        async ({ column, expectedCard }) => {
          const { props } = await setup({
            clicked: {
              column,
              value: undefined,
            },
          });

          const drill = screen.getByText("Sum over time");
          expect(drill).toBeInTheDocument();

          userEvent.click(drill);

          expect(props.onChangeCardAndRun).toHaveBeenCalledTimes(1);
          expect(props.onChangeCardAndRun).toHaveBeenLastCalledWith({
            nextCard: expect.objectContaining(expectedCard),
          });
        },
      );
    });

    describe("FKFilterDrill", () => {
      it.each([
        {
          column: createOrdersUserIdDatasetColumn(),
          columnName: createOrdersUserIdDatasetColumn().name,
          cellValue: "1",
          drillTitle: "View this User's Orders",
          expectedCard: {
            dataset_query: getFKFilteredResultDatasetQuery(
              ORDERS.USER_ID,
              "type/Integer",
              "1",
            ),
            display: "table",
          },
        },
        {
          column: createOrdersProductIdDatasetColumn(),
          columnName: createOrdersProductIdDatasetColumn().name,
          cellValue: "111",
          drillTitle: "View this Product's Orders",
          expectedCard: {
            dataset_query: getFKFilteredResultDatasetQuery(
              ORDERS.PRODUCT_ID,
              "type/Integer",
              "111",
            ),
            display: "table",
          },
        },
      ])(
        "should apply drill on $columnName cell click",
        async ({ column, columnName, cellValue, drillTitle, expectedCard }) => {
          const { props } = await setup({
            clicked: {
              column,
              value: cellValue,
            },
          });

          const drill = screen.getByText(drillTitle);
          expect(drill).toBeInTheDocument();

          userEvent.click(drill);

          expect(props.onChangeCardAndRun).toHaveBeenCalledTimes(1);
          expect(props.onChangeCardAndRun).toHaveBeenLastCalledWith({
            nextCard: expect.objectContaining(expectedCard),
          });
        },
      );
    });
  });
});

async function setup({
  question = Question.create({
    databaseId: SAMPLE_DB_ID,
    tableId: ORDERS_ID,
    metadata: SAMPLE_METADATA,
  }),
  clicked = {
    column: createOrdersIdDatasetColumn(),
    value: undefined,
  },
  settings = {},
  dimension: inputDimension,
}: Partial<{
  question: Question;
  clicked: ClickObject | undefined;
  settings: Record<string, any>;
  dimension?: Dimension;
}> = {}) {
  const mode = checkNotNull(getMode(question));

  const dimension =
    inputDimension ||
    (question?.query() as StructuredQuery).dimensionForColumn(
      checkNotNull(clicked?.column),
    );

  clicked = {
    ...clicked,
    dimension: dimension || undefined,
  };

  const clickActions = mode.actionsForClick(
    {
      ...clicked,
    },
    settings,
  ) as RegularClickAction[];

  const dispatch = jest.fn();
  const onChangeCardAndRun = jest.fn();
  const onClose = jest.fn();
  const onUpdateVisualizationSettings = jest.fn();

  // used only in FormatDrill. To be refactored. I think we should pass this widget from the outside, ready to be rendered
  const series: Series = [
    createMockSingleSeries(
      {
        dataset_query: question.datasetQuery(),
      },
      {
        data: {
          cols: [...ORDERS_COLUMNS],
          rows: [],
          requested_timezone: "UTC",
          results_timezone: "Asia/Nicosia",
          results_metadata: {
            columns: [...ORDERS_COLUMNS],
          },
        },
      },
    ),
  ];

  const view = renderWithProviders(
    <ClickActionsPopover
      clickActions={clickActions}
      clicked={clicked}
      series={series}
      dispatch={dispatch}
      onChangeCardAndRun={onChangeCardAndRun}
      onUpdateVisualizationSettings={onUpdateVisualizationSettings}
      onClose={onClose}
    />,
  );

  const updatedClicked = {
    ...clicked,
    element: view.baseElement,
  };

  view.rerender(
    <ClickActionsPopover
      clickActions={clickActions}
      clicked={updatedClicked}
      series={series as unknown as Series}
      dispatch={dispatch}
      onChangeCardAndRun={onChangeCardAndRun}
      onUpdateVisualizationSettings={onUpdateVisualizationSettings}
      onClose={onClose}
    />,
  );

  await waitFor(async () => {
    expect(
      (await screen.findAllByTestId("drill-through-section")).length,
    ).toBeGreaterThan(0);
  });

  return {
    props: {
      clickActions,
      clicked: updatedClicked,
      series,
      dispatch,
      onChangeCardAndRun,
      onUpdateVisualizationSettings,
      onClose,
    },
    view,
  };
}

function getSummarizedOverTimeResultDatasetQuery(
  aggregatedColumnId: number,
  aggregatedColumnType: string,
): DatasetQuery {
  return {
    database: SAMPLE_DB_ID,
    query: {
      aggregation: [
        [
          "sum",
          [
            "field",
            aggregatedColumnId,
            {
              "base-type": aggregatedColumnType,
            },
          ],
        ],
      ],
      breakout: [
        [
          "field",
          ORDERS.CREATED_AT,
          {
            "base-type": "type/DateTime",
            "temporal-unit": "month",
          },
        ],
      ],
      "source-table": ORDERS_ID,
    },
    type: "query",
  };
}

function getFKFilteredResultDatasetQuery(
  filteredColumnId: number,
  filteredColumnType: string,
  cellValue: string,
): DatasetQuery {
  return {
    database: SAMPLE_DB_ID,
    query: {
      filter: [
        "=",
        [
          "field",
          filteredColumnId,
          {
            "base-type": filteredColumnType,
          },
        ],
        cellValue,
      ],
      "source-table": ORDERS_ID,
    },
    type: "query",
  };
}
