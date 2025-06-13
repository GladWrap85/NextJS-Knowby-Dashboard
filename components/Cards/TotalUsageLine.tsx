import { ResponsiveBar } from '@nivo/bar'

const MyBar = ({ data /* see data tab */ }) => (
  <ResponsiveBar /* or Bar for fixed dimensions */
    data={data}
    indexBy="country"
    groupMode="grouped"
    enableGridX={true}
    enableLabel={false}
    labelSkipWidth={11}
    labelSkipHeight={12}
    borderRadius={5}
    borderColor={{ from: 'color', modifiers: [] }}
    tooltip="CustomTooltip"
    margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
  />
)