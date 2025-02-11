async function readPlyFile(file_path: string) {
    try {
      const response = await fetch(file_path);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // const text = await response.text();
      const buffer = await response.arrayBuffer();
      // Process the binary PLY file data here
      // console.log(`text.length: ${text.length}`);
      console.log(`buffer.byteLength: ${buffer.byteLength}`);
      const decoder = new TextDecoder("utf-8");
      const plyText = decoder.decode(buffer.slice(0, 10000));
      const lastHeaderIndex = plyText.indexOf("end_header") + "end_header".length + 1;
      const plySubText = plyText.slice(undefined, lastHeaderIndex);
      console.log(`plyText: ${plyText}`);
      console.log(`plySubText: ${plySubText}`);

      let vertexCount = 0;
      const properties = [];
      const lines = plySubText.split('\n');
      for (const line of lines) {
        if (line.startsWith('element vertex ')) {
          vertexCount = parseInt(line.split(' ')[2]);
        }
        else if (line.startsWith('property float ')) {
          properties.push(line.split(' ')[2]);
        }
      }
      console.log(`vertexCount: ${vertexCount}`);
      console.log(`properties: ${properties}`);

      const float32Array = new Float32Array(buffer.slice(lastHeaderIndex, lastHeaderIndex + 4 * vertexCount * properties.length));
      const vertices = [];
      for (let i = 0; i < vertexCount; i++) {
        const vertex: { [key: string]: number } = {};
        for (let j = 0; j < properties.length; j++) {
          vertex[properties[j]] = float32Array[i * properties.length + j];
        }
        vertices.push(vertex);
      }
      console.log(`vertices[0]: ${JSON.stringify(vertices[0])}`);
      console.log(`vertices[1]: ${JSON.stringify(vertices[1])}`);
      return vertices;
    } catch (error) {
      console.error('Error loading PLY file:', error);
      return null;
    }
  }

  export default readPlyFile;
