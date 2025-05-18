'use client';

import { Line } from '@nivo/line'
import AutoSizer from 'react-virtualized-auto-sizer'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const MyResponsiveLine = ({ data }: any) => {
  return (
    <AutoSizer>
      {({ width, height }) => (
        <Line
          data={data}
          width={width}
          height={height}
          margin={{ top: 20, right: 20, bottom: 60, left: 50 }}
          xScale={{ type: 'point' }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto',
            stacked: true,
            reverse: false
          }}
          yFormat=" >-.2f"
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
          pointSize={10}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'seriesColor' }}
          pointLabelYOffset={-12}
          enableTouchCrosshair={true}
          useMesh={true}
          legends={[
            {
              anchor: 'top',
              direction: 'row',
              justify: false,
              translateX: 0,
              translateY: -20,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              itemOpacity: 0.75,
              symbolSize: 12,
              symbolShape: 'circle',
              symbolBorderColor: 'rgba(0, 0, 0, .5)',
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemBackground: 'rgba(0, 0, 0, .03)',
                    itemOpacity: 1
                  }
                }
              ]
            }
          ]}
          role="application"
        />
      )}
    </AutoSizer>
  );
};

export default function General() {
  const data = [
    {
      "id": "japan",
      "data": [
        {
          "x": "plane",
          "y": 272
        },
        {
          "x": "helicopter",
          "y": 276
        },
        {
          "x": "boat",
          "y": 202
        },
        {
          "x": "train",
          "y": 216
        },
        {
          "x": "subway",
          "y": 258
        },
        {
          "x": "bus",
          "y": 29
        },
        {
          "x": "car",
          "y": 230
        },
        {
          "x": "moto",
          "y": 18
        },
        {
          "x": "bicycle",
          "y": 4
        },
        {
          "x": "horse",
          "y": 87
        },
        {
          "x": "skateboard",
          "y": 94
        },
        {
          "x": "others",
          "y": 293
        }
      ]
    },
    {
      "id": "france",
      "data": [
        {
          "x": "plane",
          "y": 121
        },
        {
          "x": "helicopter",
          "y": 230
        },
        {
          "x": "boat",
          "y": 58
        },
        {
          "x": "train",
          "y": 69
        },
        {
          "x": "subway",
          "y": 18
        },
        {
          "x": "bus",
          "y": 28
        },
        {
          "x": "car",
          "y": 276
        },
        {
          "x": "moto",
          "y": 296
        },
        {
          "x": "bicycle",
          "y": 227
        },
        {
          "x": "horse",
          "y": 66
        },
        {
          "x": "skateboard",
          "y": 264
        },
        {
          "x": "others",
          "y": 228
        }
      ]
    },
    {
      "id": "us",
      "data": [
        {
          "x": "plane",
          "y": 188
        },
        {
          "x": "helicopter",
          "y": 69
        },
        {
          "x": "boat",
          "y": 23
        },
        {
          "x": "train",
          "y": 280
        },
        {
          "x": "subway",
          "y": 255
        },
        {
          "x": "bus",
          "y": 86
        },
        {
          "x": "car",
          "y": 85
        },
        {
          "x": "moto",
          "y": 132
        },
        {
          "x": "bicycle",
          "y": 134
        },
        {
          "x": "horse",
          "y": 251
        },
        {
          "x": "skateboard",
          "y": 33
        },
        {
          "x": "others",
          "y": 277
        }
      ]
    },
    {
      "id": "germany",
      "data": [
        {
          "x": "plane",
          "y": 80
        },
        {
          "x": "helicopter",
          "y": 297
        },
        {
          "x": "boat",
          "y": 98
        },
        {
          "x": "train",
          "y": 49
        },
        {
          "x": "subway",
          "y": 297
        },
        {
          "x": "bus",
          "y": 45
        },
        {
          "x": "car",
          "y": 164
        },
        {
          "x": "moto",
          "y": 20
        },
        {
          "x": "bicycle",
          "y": 193
        },
        {
          "x": "horse",
          "y": 134
        },
        {
          "x": "skateboard",
          "y": 60
        },
        {
          "x": "others",
          "y": 75
        }
      ]
    },
    {
      "id": "norway",
      "data": [
        {
          "x": "plane",
          "y": 22
        },
        {
          "x": "helicopter",
          "y": 197
        },
        {
          "x": "boat",
          "y": 263
        },
        {
          "x": "train",
          "y": 222
        },
        {
          "x": "subway",
          "y": 220
        },
        {
          "x": "bus",
          "y": 278
        },
        {
          "x": "car",
          "y": 185
        },
        {
          "x": "moto",
          "y": 238
        },
        {
          "x": "bicycle",
          "y": 157
        },
        {
          "x": "horse",
          "y": 138
        },
        {
          "x": "skateboard",
          "y": 174
        },
        {
          "x": "others",
          "y": 17
        }
      ]
    }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardDescription>These are the results of this week.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px]"> {/* Ensure height is set */}
        <MyResponsiveLine data={data} />
      </CardContent>
    </Card>
  );
}
