# Abstract
This paper presents the first learning-based generative pipeline for effectively creating 3D LEGO 1 models. This task is very challenging due to the lack of dedicated representations and datasets for learning coherently-connected bricks arrangements, as well as an immense design space that is combinatorial in nature. We approach this task by focusing on creating LEGO micro buildings.

Our contributions are four-fold. First, we propose the LEGO semantic volume representation to encode LEGO models, considering the bricks types and bricks connections, while allowing back-propagation learning. Second, we further consider the transformative nature of LEGO to atomize the semantic volume and formulate a generative model to learn the representation. Third, we build a rich dataset of micro buildings for model learning. Last, we design the progressive reconstructor to create 3D LEGO models from the generated representations, while ensuring bricks connections.

We employed our pipeline to create LEGO micro buildings with a wide array of bricks types, demonstrating its strong capability of learning diverse micro-building styles and producing assemble-able LEGO models. Further, we performed various quantitative evaluations, ablations, and a user study to show the compelling capability of our approach in terms of generative quality, fidelity, and diversity.

# Download
- [Paper (ACM DL)](https://dlnext.acm.org/doi/10.1145/3687755)
- [PDF](https://dlnext.acm.org/doi/pdf/10.1145/3687755)