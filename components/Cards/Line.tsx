'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// install (please try to align the version of installed @nivo packages)
// yarn add @nivo/line
import { ResponsiveLine } from '@nivo/line'

// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
// website examples showcase many properties,
// you'll often use just a few of them.
const MyResponsiveLine = ({ data /* see data tab */ }: any) => {
  return (
    <ResponsiveLine
      data={data}
      xScale={{ type: 'point' }}
      yScale={{
        type: 'linear',
        min: 'auto',
        max: 'auto',
        stacked: true,
        reverse: false
      }}
      yFormat=" >-.2f"
      curve="cardinal"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'transportation',
        legendOffset: 36,
        legendPosition: 'middle',
        truncateTickAt: 0
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'count',
        legendOffset: -40,
        legendPosition: 'middle',
        truncateTickAt: 0
      }}
      enableGridX={false}
      colors={{ scheme: 'blues' }}
      pointSize={10}
      pointColor={{ theme: 'background' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'seriesColor', modifiers: [] }}
      pointLabelYOffset={-12}
      areaOpacity={0.25}
      enableSlices="x"
      enableTouchCrosshair={true}
      useMesh={true}
      role="application"
    />
  )
}
export default function Lines() {
  const data = [
    {
      "id": "japan",
      "data": [
        {
          "x": "plane",
          "y": 188
        },
        {
          "x": "helicopter",
          "y": 210
        },
        {
          "x": "boat",
          "y": 212
        },
        {
          "x": "train",
          "y": 59
        },
        {
          "x": "subway",
          "y": 53
        },
        {
          "x": "bus",
          "y": 266
        },
        {
          "x": "car",
          "y": 89
        },
        {
          "x": "moto",
          "y": 284
        },
        {
          "x": "bicycle",
          "y": 240
        },
        {
          "x": "horse",
          "y": 236
        },
        {
          "x": "skateboard",
          "y": 139
        },
        {
          "x": "others",
          "y": 298
        }
      ]
    },
    {
      "id": "france",
      "data": [
        {
          "x": "plane",
          "y": 107
        },
        {
          "x": "helicopter",
          "y": 225
        },
        {
          "x": "boat",
          "y": 196
        },
        {
          "x": "train",
          "y": 63
        },
        {
          "x": "subway",
          "y": 88
        },
        {
          "x": "bus",
          "y": 92
        },
        {
          "x": "car",
          "y": 167
        },
        {
          "x": "moto",
          "y": 37
        },
        {
          "x": "bicycle",
          "y": 279
        },
        {
          "x": "horse",
          "y": 161
        },
        {
          "x": "skateboard",
          "y": 246
        },
        {
          "x": "others",
          "y": 153
        }
      ]
    },
    {
      "id": "us",
      "data": [
        {
          "x": "plane",
          "y": 74
        },
        {
          "x": "helicopter",
          "y": 229
        },
        {
          "x": "boat",
          "y": 165
        },
        {
          "x": "train",
          "y": 64
        },
        {
          "x": "subway",
          "y": 93
        },
        {
          "x": "bus",
          "y": 209
        },
        {
          "x": "car",
          "y": 266
        },
        {
          "x": "moto",
          "y": 113
        },
        {
          "x": "bicycle",
          "y": 66
        },
        {
          "x": "horse",
          "y": 15
        },
        {
          "x": "skateboard",
          "y": 49
        },
        {
          "x": "others",
          "y": 298
        }
      ]
    },
    {
      "id": "germany",
      "data": [
        {
          "x": "plane",
          "y": 71
        },
        {
          "x": "helicopter",
          "y": 192
        },
        {
          "x": "boat",
          "y": 151
        },
        {
          "x": "train",
          "y": 297
        },
        {
          "x": "subway",
          "y": 250
        },
        {
          "x": "bus",
          "y": 250
        },
        {
          "x": "car",
          "y": 295
        },
        {
          "x": "moto",
          "y": 86
        },
        {
          "x": "bicycle",
          "y": 57
        },
        {
          "x": "horse",
          "y": 54
        },
        {
          "x": "skateboard",
          "y": 117
        },
        {
          "x": "others",
          "y": 167
        }
      ]
    },
    {
      "id": "norway",
      "data": [
        {
          "x": "plane",
          "y": 125
        },
        {
          "x": "helicopter",
          "y": 99
        },
        {
          "x": "boat",
          "y": 221
        },
        {
          "x": "train",
          "y": 68
        },
        {
          "x": "subway",
          "y": 152
        },
        {
          "x": "bus",
          "y": 191
        },
        {
          "x": "car",
          "y": 153
        },
        {
          "x": "moto",
          "y": 124
        },
        {
          "x": "bicycle",
          "y": 294
        },
        {
          "x": "horse",
          "y": 68
        },
        {
          "x": "skateboard",
          "y": 136
        },
        {
          "x": "others",
          "y": 257
        }
      ]
    }
  ]


  return <Card>
    <CardHeader>
      <CardTitle>Lines</CardTitle>
      <CardDescription>These are the stats of the year.</CardDescription>
    </CardHeader>
    <CardContent className="h-[264px] flex items-center w-full">
      <MyResponsiveLine data={data} />
    </CardContent>
  </Card>
}